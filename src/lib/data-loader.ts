import { supabase } from "./supabase";
import { getHardcodedRouteData } from "./hardcoded-routes";
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
  const data = getHardcodedRouteData();
  return data.routeStops.get(routeId) || [];
}

/**
 * Load and parse route data from hardcoded JSON files
 * Uses local data for reliable algorithm calculations
 */
export async function loadRouteData(): Promise<ParsedRouteData> {
  return getHardcodedRouteData();
}

/**
 * Get raw GeoJSON data (for backward compatibility with Map component)
 */
export async function getRawGeoJSON(): Promise<GeoJSONFeatureCollection> {
  const data = getHardcodedRouteData();
  const routes = Array.from(data.routes.values());
  const stops = Array.from(data.stops.values());

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
