import {
  Coordinates,
  GeoJSONRoute,
  GeoJSONStop,
  GeoJSONFeatureCollection,
  ParsedRouteData,
  RouteResult,
  RouteSegment,
  RouteSearchRequest,
} from "./types";
import {
  findNearestStop,
  findStopsWithinRadius,
  getStopCoordinates,
  haversineDistance,
  calculateRouteDistance,
  estimateDuration,
} from "./geo-utils";

/**
 * Parse GeoJSON data into structured format for algorithm use
 */
export function parseGeoJSONData(
  geojson: GeoJSONFeatureCollection
): ParsedRouteData {
  const routes = new Map<string, GeoJSONRoute>();
  const stops = new Map<string, GeoJSONStop>();
  const routeStops = new Map<string, GeoJSONStop[]>();
  const stopRoutes = new Map<string, string[]>();

  // First pass: separate routes and stops
  for (const feature of geojson.features) {
    if (feature.geometry.type === "LineString") {
      const route = feature as GeoJSONRoute;
      routes.set(route.properties.routeId, route);
      routeStops.set(route.properties.routeId, []);
    } else if (feature.geometry.type === "Point") {
      const stop = feature as GeoJSONStop;
      stops.set(stop.properties.stopId, stop);
      stopRoutes.set(stop.properties.stopId, stop.properties.routeIds);
    }
  }

  // Second pass: organize stops by route
  for (const [stopId, stop] of stops) {
    for (const routeId of stop.properties.routeIds) {
      const stopsForRoute = routeStops.get(routeId);
      if (stopsForRoute) {
        stopsForRoute.push(stop);
      }
    }
  }

  // Sort stops within each route by order
  for (const [routeId, stopsArr] of routeStops) {
    stopsArr.sort((a, b) => a.properties.order - b.properties.order);
  }

  return { routes, stops, routeStops, stopRoutes };
}

/**
 * Find common routes between two stops
 */
function findCommonRoutes(
  stop1: GeoJSONStop,
  stop2: GeoJSONStop
): string[] {
  const routes1 = new Set(stop1.properties.routeIds);
  const routes2 = stop2.properties.routeIds;
  return routes2.filter((r) => routes1.has(r));
}

/**
 * Get stops between two stops on the same route (inclusive)
 */
function getStopsBetween(
  routeStops: GeoJSONStop[],
  fromStop: GeoJSONStop,
  toStop: GeoJSONStop
): GeoJSONStop[] {
  const fromIndex = routeStops.findIndex(
    (s) => s.properties.stopId === fromStop.properties.stopId
  );
  const toIndex = routeStops.findIndex(
    (s) => s.properties.stopId === toStop.properties.stopId
  );

  if (fromIndex === -1 || toIndex === -1) return [];

  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);

  return routeStops.slice(start, end + 1);
}

/**
 * Create a route segment
 */
function createSegment(
  routeId: string,
  routeData: ParsedRouteData,
  boardingStop: GeoJSONStop,
  alightingStop: GeoJSONStop
): RouteSegment {
  const route = routeData.routes.get(routeId)!;
  const routeStops = routeData.routeStops.get(routeId) || [];
  const stopsBetween = getStopsBetween(routeStops, boardingStop, alightingStop);
  const intermediateStops = stopsBetween.slice(1, -1);

  return {
    routeId,
    routeName: route.properties.routeName,
    routeColor: route.properties.color,
    boardingStop,
    alightingStop,
    intermediateStops,
    stopsCount: stopsBetween.length,
    distanceKm: calculateRouteDistance(stopsBetween),
  };
}

/**
 * Find single-ride route (no transfer needed)
 */
function findSingleRoute(
  boardingStop: GeoJSONStop,
  alightingStop: GeoJSONStop,
  routeData: ParsedRouteData
): RouteResult | null {
  const commonRoutes = findCommonRoutes(boardingStop, alightingStop);

  if (commonRoutes.length === 0) return null;

  // Use the first common route (could be optimized to pick the best)
  const routeId = commonRoutes[0];
  const segment = createSegment(routeId, routeData, boardingStop, alightingStop);

  return {
    type: "single",
    segments: [segment],
    totalStops: segment.stopsCount,
    totalDistanceKm: segment.distanceKm,
    transferPoints: [],
    estimatedDuration: estimateDuration(segment.distanceKm),
  };
}

/**
 * Find transfer route (double ride)
 */
function findTransferRoute(
  boardingStop: GeoJSONStop,
  alightingStop: GeoJSONStop,
  routeData: ParsedRouteData
): RouteResult | null {
  const boardingRoutes = boardingStop.properties.routeIds;
  const alightingRoutes = alightingStop.properties.routeIds;

  // Find all possible transfer points
  const transferOptions: {
    transferStop: GeoJSONStop;
    firstRouteId: string;
    secondRouteId: string;
    score: number;
  }[] = [];

  // For each route from boarding stop
  for (const firstRouteId of boardingRoutes) {
    const firstRouteStops = routeData.routeStops.get(firstRouteId) || [];

    // Check each stop on this route as potential transfer point
    for (const potentialTransfer of firstRouteStops) {
      // Skip if it's the boarding stop itself
      if (potentialTransfer.properties.stopId === boardingStop.properties.stopId) {
        continue;
      }

      // Check if this stop connects to any route that reaches the destination
      for (const secondRouteId of potentialTransfer.properties.routeIds) {
        // Skip if it's the same route
        if (secondRouteId === firstRouteId) continue;

        // Check if alighting stop is on this second route
        if (alightingRoutes.includes(secondRouteId)) {
          // Calculate score (lower is better) - based on total distance
          const firstSegmentStops = getStopsBetween(
            firstRouteStops,
            boardingStop,
            potentialTransfer
          );
          const secondRouteStops = routeData.routeStops.get(secondRouteId) || [];
          const secondSegmentStops = getStopsBetween(
            secondRouteStops,
            potentialTransfer,
            alightingStop
          );

          const totalDistance =
            calculateRouteDistance(firstSegmentStops) +
            calculateRouteDistance(secondSegmentStops);

          transferOptions.push({
            transferStop: potentialTransfer,
            firstRouteId,
            secondRouteId,
            score: totalDistance,
          });
        }
      }
    }
  }

  if (transferOptions.length === 0) return null;

  // Sort by score and pick the best
  transferOptions.sort((a, b) => a.score - b.score);
  const best = transferOptions[0];

  const firstSegment = createSegment(
    best.firstRouteId,
    routeData,
    boardingStop,
    best.transferStop
  );
  const secondSegment = createSegment(
    best.secondRouteId,
    routeData,
    best.transferStop,
    alightingStop
  );

  const totalDistance = firstSegment.distanceKm + secondSegment.distanceKm;

  return {
    type: "transfer",
    segments: [firstSegment, secondSegment],
    totalStops: firstSegment.stopsCount + secondSegment.stopsCount - 1, // -1 for shared transfer stop
    totalDistanceKm: totalDistance,
    transferPoints: [best.transferStop],
    estimatedDuration: estimateDuration(totalDistance) + 5, // +5 min for transfer wait
  };
}

/**
 * Main route finding function
 */
export function findRoute(
  request: RouteSearchRequest,
  routeData: ParsedRouteData
): RouteResult | null {
  const allStops = Array.from(routeData.stops.values());

  // Find nearest stops to origin and destination
  const nearestToOrigin = findNearestStop(request.origin, allStops);
  const nearestToDestination = findNearestStop(request.destination, allStops);

  if (!nearestToOrigin || !nearestToDestination) {
    return null;
  }

  const boardingStop = nearestToOrigin.stop;
  const alightingStop = nearestToDestination.stop;

  // If same stop, no route needed
  if (boardingStop.properties.stopId === alightingStop.properties.stopId) {
    return null;
  }

  // Try single route first
  const singleRoute = findSingleRoute(boardingStop, alightingStop, routeData);
  if (singleRoute) {
    return singleRoute;
  }

  // Try transfer route
  const maxTransfers = request.maxTransfers ?? 1;
  if (maxTransfers >= 1) {
    const transferRoute = findTransferRoute(boardingStop, alightingStop, routeData);
    if (transferRoute) {
      return transferRoute;
    }
  }

  return null;
}

/**
 * Find all possible routes (for showing alternatives)
 */
export function findAllRoutes(
  request: RouteSearchRequest,
  routeData: ParsedRouteData,
  maxResults: number = 3
): RouteResult[] {
  const allStops = Array.from(routeData.stops.values());
  const results: RouteResult[] = [];

  // Find stops near origin (within 500m)
  const stopsNearOrigin = findStopsWithinRadius(request.origin, allStops, 0.5);
  // Find stops near destination (within 500m)
  const stopsNearDestination = findStopsWithinRadius(
    request.destination,
    allStops,
    0.5
  );

  // If no nearby stops, expand search radius
  const originStops =
    stopsNearOrigin.length > 0
      ? stopsNearOrigin
      : findStopsWithinRadius(request.origin, allStops, 2);
  const destStops =
    stopsNearDestination.length > 0
      ? stopsNearDestination
      : findStopsWithinRadius(request.destination, allStops, 2);

  // Try all combinations
  for (const { stop: boardingStop } of originStops) {
    for (const { stop: alightingStop } of destStops) {
      if (boardingStop.properties.stopId === alightingStop.properties.stopId) {
        continue;
      }

      // Try single route
      const singleRoute = findSingleRoute(boardingStop, alightingStop, routeData);
      if (singleRoute) {
        results.push(singleRoute);
      }

      // Try transfer route
      const transferRoute = findTransferRoute(
        boardingStop,
        alightingStop,
        routeData
      );
      if (transferRoute) {
        results.push(transferRoute);
      }
    }
  }

  // Sort by total distance and remove duplicates
  const uniqueResults = results.filter(
    (r, i, arr) =>
      arr.findIndex(
        (r2) =>
          r2.segments[0]?.routeId === r.segments[0]?.routeId &&
          r2.segments[0]?.boardingStop.properties.stopId ===
            r.segments[0]?.boardingStop.properties.stopId
      ) === i
  );

  return uniqueResults
    .sort((a, b) => a.totalDistanceKm - b.totalDistanceKm)
    .slice(0, maxResults);
}

/**
 * Get readable directions for a route result
 */
export function getRouteDirections(result: RouteResult): string[] {
  const directions: string[] = [];

  for (let i = 0; i < result.segments.length; i++) {
    const segment = result.segments[i];

    if (i === 0) {
      directions.push(
        `Board "${segment.routeName}" at ${segment.boardingStop.properties.stopName}`
      );
    } else {
      directions.push(
        `Transfer to "${segment.routeName}" at ${segment.boardingStop.properties.stopName}`
      );
    }

    if (segment.intermediateStops.length > 0) {
      directions.push(
        `Pass through ${segment.intermediateStops.length} stop(s)`
      );
    }

    directions.push(
      `Alight at ${segment.alightingStop.properties.stopName}`
    );
  }

  return directions;
}
