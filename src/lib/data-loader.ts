import { GeoJSONFeatureCollection, ParsedRouteData } from "./types";
import { parseGeoJSONData } from "./route-algorithm";
import routesData from "@/data/routes.json";

let cachedData: ParsedRouteData | null = null;

/**
 * Load and parse route data from GeoJSON
 * Uses cached data if available
 */
export function loadRouteData(): ParsedRouteData {
  if (cachedData) {
    return cachedData;
  }

  cachedData = parseGeoJSONData(routesData as GeoJSONFeatureCollection);
  return cachedData;
}

/**
 * Get raw GeoJSON data
 */
export function getRawGeoJSON(): GeoJSONFeatureCollection {
  return routesData as GeoJSONFeatureCollection;
}

/**
 * Clear cached data (useful for hot reloading during development)
 */
export function clearCache(): void {
  cachedData = null;
}
