import { supabase } from "./supabase";
import type {
  GeoJSONRoute,
  GeoJSONStop,
  GeoJSONFeatureCollection,
  ParsedRouteData,
  Coordinates,
} from "./types";
import type {
  DbRouteWithCoordinates,
  DbStopWithRoutes,
  NearestStopResult,
  RouteStopResult,
} from "./database.types";

/**
 * Basic route info for display (without coordinates)
 */
export interface RouteInfo {
  routeId: string;
  routeNumber: string;
  name: string;
  area: string | null;
  timePeriod: string | null;
  color: string;
}

/**
 * Load basic route info for homepage display
 */
export async function loadRoutesList(): Promise<RouteInfo[]> {
  const { data, error } = await supabase
    .from("routes")
    .select("route_id, route_number, name, area, time_period, color")
    .order("route_number")
    .order("time_period");

  if (error) {
    console.error("Error loading routes list:", error);
    return [];
  }

  return data.map((route) => ({
    routeId: route.route_id,
    routeNumber: route.route_number,
    name: route.name,
    area: route.area,
    timePeriod: route.time_period,
    color: route.color,
  }));
}

/**
 * Convert database route to GeoJSON format
 */
function dbRouteToGeoJSON(dbRoute: DbRouteWithCoordinates): GeoJSONRoute {
  return {
    type: "Feature",
    properties: {
      routeId: dbRoute.route_id,
      routeName: dbRoute.route_name,
      color: dbRoute.color,
      description: dbRoute.description || undefined,
    },
    geometry: {
      type: "LineString",
      coordinates: dbRoute.geojson.coordinates,
    },
  };
}

/**
 * Convert database stop to GeoJSON format
 */
function dbStopToGeoJSON(
  dbStop: DbStopWithRoutes,
  order: number = 0
): GeoJSONStop {
  return {
    type: "Feature",
    properties: {
      stopId: dbStop.stop_id,
      stopName: dbStop.stop_name,
      routeIds: dbStop.route_ids || [],
      order: order,
      description: dbStop.description || undefined,
    },
    geometry: {
      type: "Point",
      coordinates: [dbStop.lng, dbStop.lat], // GeoJSON is [lng, lat]
    },
  };
}

/**
 * Load all routes from database
 */
export async function loadAllRoutes(): Promise<GeoJSONRoute[]> {
  const { data, error } = await supabase
    .from("routes_with_coordinates")
    .select("*");

  if (error) {
    console.error("Error loading routes:", error);
    return [];
  }

  return (data as DbRouteWithCoordinates[]).map(dbRouteToGeoJSON);
}

/**
 * Load all stops with their route associations
 */
export async function loadAllStops(): Promise<GeoJSONStop[]> {
  const { data, error } = await supabase
    .from("stops_with_routes")
    .select("*");

  if (error) {
    console.error("Error loading stops:", error);
    return [];
  }

  return (data as DbStopWithRoutes[]).map((stop) => dbStopToGeoJSON(stop, 0));
}

/**
 * Get ordered stops for a specific route
 */
export async function getOrderedStopsForRoute(
  routeId: string
): Promise<GeoJSONStop[]> {
  const { data, error } = await supabase.rpc("get_route_stops", {
    p_route_id: routeId,
  });

  if (error) {
    console.error(`Error loading stops for route ${routeId}:`, error);
    return [];
  }

  return (data as RouteStopResult[]).map((stop) => ({
    type: "Feature" as const,
    properties: {
      stopId: stop.stop_id,
      stopName: stop.stop_name,
      routeIds: stop.route_ids || [],
      order: stop.stop_order,
      description: stop.description || undefined,
    },
    geometry: {
      type: "Point" as const,
      coordinates: [stop.lng, stop.lat] as [number, number],
    },
  }));
}

/**
 * Load and parse route data from database
 * Returns the same ParsedRouteData structure for backward compatibility
 */
export async function loadRouteData(): Promise<ParsedRouteData> {
  const [routesData, stopsData] = await Promise.all([
    loadAllRoutes(),
    loadAllStops(),
  ]);

  const routes = new Map<string, GeoJSONRoute>();
  const stops = new Map<string, GeoJSONStop>();
  const routeStops = new Map<string, GeoJSONStop[]>();
  const stopRoutes = new Map<string, string[]>();

  // Populate routes map
  for (const route of routesData) {
    routes.set(route.properties.routeId, route);
    routeStops.set(route.properties.routeId, []);
  }

  // Populate stops map and stopRoutes
  for (const stop of stopsData) {
    stops.set(stop.properties.stopId, stop);
    stopRoutes.set(stop.properties.stopId, stop.properties.routeIds);
  }

  // Fetch ordered stops for each route
  const routeIds = Array.from(routes.keys());
  const orderedStopsPromises = routeIds.map((routeId) =>
    getOrderedStopsForRoute(routeId).then((orderedStops) => ({
      routeId,
      orderedStops,
    }))
  );

  const orderedStopsResults = await Promise.all(orderedStopsPromises);
  for (const { routeId, orderedStops } of orderedStopsResults) {
    routeStops.set(routeId, orderedStops);
  }

  return { routes, stops, routeStops, stopRoutes };
}

/**
 * Get raw GeoJSON data (for backward compatibility with Map component)
 */
export async function getRawGeoJSON(): Promise<GeoJSONFeatureCollection> {
  const [routes, stops] = await Promise.all([loadAllRoutes(), loadAllStops()]);

  return {
    type: "FeatureCollection",
    features: [...routes, ...stops],
  };
}

/**
 * Find nearest stop using PostGIS ST_Distance
 */
export async function findNearestStopDB(
  location: Coordinates,
  limit: number = 1
): Promise<NearestStopResult[]> {
  const { data, error } = await supabase.rpc("find_nearest_stop", {
    p_lat: location.lat,
    p_lng: location.lng,
    p_limit: limit,
  });

  if (error) {
    console.error("Error finding nearest stop:", error);
    return [];
  }

  return data as NearestStopResult[];
}

/**
 * Find stops within radius using PostGIS ST_DWithin
 */
export async function findStopsWithinRadiusDB(
  location: Coordinates,
  radiusMeters: number
): Promise<NearestStopResult[]> {
  const { data, error } = await supabase.rpc("find_stops_within_radius", {
    p_lat: location.lat,
    p_lng: location.lng,
    p_radius_meters: radiusMeters,
  });

  if (error) {
    console.error("Error finding stops within radius:", error);
    return [];
  }

  return data as NearestStopResult[];
}

/**
 * Find common routes between two stops using database
 */
export async function findCommonRoutesDB(
  stopId1: string,
  stopId2: string
): Promise<string[]> {
  const { data, error } = await supabase.rpc("find_common_routes", {
    p_stop_id_1: stopId1,
    p_stop_id_2: stopId2,
  });

  if (error) {
    console.error("Error finding common routes:", error);
    return [];
  }

  return (data as { route_id: string }[]).map((r) => r.route_id);
}
