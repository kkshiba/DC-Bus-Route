import {
  Coordinates,
  GeoJSONRoute,
  GeoJSONStop,
  GeoJSONFeatureCollection,
  ParsedRouteData,
  RouteResult,
  RouteSegment,
  RouteSearchRequest,
  WalkingTransfer,
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

// Transfer option type for internal use
interface TransferOption {
  dropOffStop: GeoJSONStop;
  walkToStop?: GeoJSONStop; // Only for walking transfers
  walkingDistance?: number; // km, only for walking transfers
  firstRouteId: string;
  secondRouteId: string;
  score: number;
}

/**
 * Find walking transfers (fallback when no shared-stop transfer exists)
 * Searches for nearby stops within walking distance that connect to destination
 */
function findWalkingTransfers(
  boardingStop: GeoJSONStop,
  alightingStop: GeoJSONStop,
  routeData: ParsedRouteData,
  allStops: GeoJSONStop[],
  maxWalkingKm: number = 0.3 // 300 meters default
): TransferOption[] {
  const walkingOptions: TransferOption[] = [];
  const boardingRoutes = boardingStop.properties.routeIds;
  const alightingRoutes = alightingStop.properties.routeIds;

  // For each route from boarding stop
  for (const firstRouteId of boardingRoutes) {
    const firstRouteStops = routeData.routeStops.get(firstRouteId) || [];

    // For each stop on first route (potential drop-off point)
    for (const dropOffStop of firstRouteStops) {
      // Skip if it's the boarding stop itself
      if (dropOffStop.properties.stopId === boardingStop.properties.stopId) continue;

      // Find nearby stops within walking distance
      const dropOffCoords: Coordinates = {
        lat: dropOffStop.geometry.coordinates[1],
        lng: dropOffStop.geometry.coordinates[0],
      };
      const nearbyStops = findStopsWithinRadius(dropOffCoords, allStops, maxWalkingKm);

      // Check each nearby stop for routes to destination
      for (const { stop: nearbyStop, distance: walkingDistance } of nearbyStops) {
        // Skip if same stop (that's a shared transfer, not walking)
        if (nearbyStop.properties.stopId === dropOffStop.properties.stopId) continue;

        for (const secondRouteId of nearbyStop.properties.routeIds) {
          // Skip if same route
          if (secondRouteId === firstRouteId) continue;
          // Check if this route reaches the destination
          if (!alightingRoutes.includes(secondRouteId)) continue;

          // Valid walking transfer found!
          const firstSegmentStops = getStopsBetween(firstRouteStops, boardingStop, dropOffStop);
          const secondRouteStops = routeData.routeStops.get(secondRouteId) || [];
          const secondSegmentStops = getStopsBetween(secondRouteStops, nearbyStop, alightingStop);

          const routeDistance =
            calculateRouteDistance(firstSegmentStops) +
            calculateRouteDistance(secondSegmentStops);
          // Add walking penalty (walking is 2x more "expensive" than bus distance)
          const walkingPenalty = walkingDistance * 2;

          walkingOptions.push({
            dropOffStop,
            walkToStop: nearbyStop,
            walkingDistance,
            firstRouteId,
            secondRouteId,
            score: routeDistance + walkingPenalty,
          });
        }
      }
    }
  }

  return walkingOptions;
}

/**
 * Find transfer route (double ride)
 * First tries shared-stop transfers, falls back to walking transfers if none found
 */
function findTransferRoute(
  boardingStop: GeoJSONStop,
  alightingStop: GeoJSONStop,
  routeData: ParsedRouteData,
  allStops?: GeoJSONStop[] // Optional: needed for walking transfers
): RouteResult | null {
  const boardingRoutes = boardingStop.properties.routeIds;
  const alightingRoutes = alightingStop.properties.routeIds;

  // Find all possible transfer points (shared stops first)
  const transferOptions: TransferOption[] = [];

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
            dropOffStop: potentialTransfer,
            firstRouteId,
            secondRouteId,
            score: totalDistance,
          });
        }
      }
    }
  }

  // If no shared-stop transfers found, try walking transfers (fallback)
  if (transferOptions.length === 0 && allStops) {
    const walkingTransfers = findWalkingTransfers(
      boardingStop,
      alightingStop,
      routeData,
      allStops,
      0.3 // 300 meters max walking distance
    );
    transferOptions.push(...walkingTransfers);
  }

  if (transferOptions.length === 0) return null;

  // Sort by score and pick the best
  transferOptions.sort((a, b) => a.score - b.score);
  const best = transferOptions[0];

  const firstSegment = createSegment(
    best.firstRouteId,
    routeData,
    boardingStop,
    best.dropOffStop
  );

  // Determine the boarding stop for second segment
  const secondBoardingStop = best.walkToStop || best.dropOffStop;

  const secondSegment = createSegment(
    best.secondRouteId,
    routeData,
    secondBoardingStop,
    alightingStop
  );

  // Add walking transfer info to first segment if this is a walking transfer
  if (best.walkToStop && best.walkingDistance) {
    firstSegment.walkToNextStop = {
      fromStop: best.dropOffStop,
      toStop: best.walkToStop,
      distanceMeters: Math.round(best.walkingDistance * 1000),
    };
  }

  const totalDistance = firstSegment.distanceKm + secondSegment.distanceKm;
  const walkingTimeMinutes = best.walkingDistance
    ? Math.ceil((best.walkingDistance / 5) * 60) // 5 km/h walking speed
    : 0;

  return {
    type: "transfer",
    segments: [firstSegment, secondSegment],
    totalStops: firstSegment.stopsCount + secondSegment.stopsCount - (best.walkToStop ? 0 : 1),
    totalDistanceKm: totalDistance + (best.walkingDistance || 0),
    transferPoints: best.walkToStop ? [best.dropOffStop, best.walkToStop] : [best.dropOffStop],
    estimatedDuration: estimateDuration(totalDistance) + 5 + walkingTimeMinutes, // +5 min wait + walking
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

  // Try transfer route (includes walking transfers as fallback)
  const maxTransfers = request.maxTransfers ?? 1;
  if (maxTransfers >= 1) {
    const transferRoute = findTransferRoute(boardingStop, alightingStop, routeData, allStops);
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

      // Try transfer route (includes walking transfers as fallback)
      const transferRoute = findTransferRoute(
        boardingStop,
        alightingStop,
        routeData,
        allStops
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
    .sort((a, b) => {
      // Priority 1: Direct routes first (type: "single")
      if (a.type !== b.type) {
        return a.type === "single" ? -1 : 1;
      }

      // Priority 2: Non-walking transfers before walking transfers
      const aHasWalking = a.segments.some((s) => s.walkToNextStop);
      const bHasWalking = b.segments.some((s) => s.walkToNextStop);
      if (aHasWalking !== bHasWalking) {
        return aHasWalking ? 1 : -1;
      }

      // Priority 3: Sort by estimated duration (faster first)
      return (a.estimatedDuration || 0) - (b.estimatedDuration || 0);
    })
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

    // Add walking transfer instruction if needed
    if (segment.walkToNextStop) {
      directions.push(
        `Walk ${segment.walkToNextStop.distanceMeters}m to ${segment.walkToNextStop.toStop.properties.stopName}`
      );
    }
  }

  return directions;
}
