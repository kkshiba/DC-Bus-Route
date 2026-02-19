import { getRawGeoJSON, loadRouteData, getOrderedStopsForRoute } from "./data-loader";
import type {
  GeoJSONFeatureCollection,
  GeoJSONRoute,
  GeoJSONStop,
  ParsedRouteData,
} from "./types";

// Singleton cache for route data
let cachedGeoJSON: GeoJSONFeatureCollection | null = null;
let cachedRouteData: ParsedRouteData | null = null;
let cachedRouteStops: Map<string, GeoJSONStop[]> = new Map();
let fetchPromise: Promise<void> | null = null;

/**
 * Ensure route data is loaded (or being loaded).
 * Safe to call multiple times - will only fetch once.
 */
export async function ensureRouteDataLoaded(): Promise<void> {
  // If already cached, return immediately
  if (cachedGeoJSON && cachedRouteData) {
    return;
  }

  // If fetch is in progress, wait for it
  if (fetchPromise) {
    return fetchPromise;
  }

  // Start fetching
  fetchPromise = (async () => {
    try {
      const [geojson, data] = await Promise.all([
        getRawGeoJSON(),
        loadRouteData(),
      ]);
      cachedGeoJSON = geojson;
      cachedRouteData = data;
    } catch (error) {
      console.error("Error prefetching route data:", error);
      // Reset promise so it can be retried
      fetchPromise = null;
      throw error;
    }
  })();

  return fetchPromise;
}

/**
 * Prefetch stops for a specific route (e.g., on hover).
 * Safe to call multiple times - will only fetch once per route.
 */
export async function prefetchRouteStops(routeId: string): Promise<void> {
  // If already cached, return immediately
  if (cachedRouteStops.has(routeId)) {
    return;
  }

  try {
    const stops = await getOrderedStopsForRoute(routeId);
    cachedRouteStops.set(routeId, stops);
  } catch (error) {
    console.error(`Error prefetching stops for route ${routeId}:`, error);
  }
}

/**
 * Get cached GeoJSON data.
 * Returns null if not yet loaded.
 */
export function getCachedGeoJSON(): GeoJSONFeatureCollection | null {
  return cachedGeoJSON;
}

/**
 * Get cached parsed route data.
 * Returns null if not yet loaded.
 */
export function getCachedRouteData(): ParsedRouteData | null {
  return cachedRouteData;
}

/**
 * Get cached stops for a specific route.
 * Returns null if not yet loaded.
 */
export function getCachedRouteStops(routeId: string): GeoJSONStop[] | null {
  return cachedRouteStops.get(routeId) || null;
}

/**
 * Check if main route data is cached.
 */
export function isRouteDataCached(): boolean {
  return cachedGeoJSON !== null && cachedRouteData !== null;
}

/**
 * Check if stops for a specific route are cached.
 */
export function isRouteStopsCached(routeId: string): boolean {
  return cachedRouteStops.has(routeId);
}

/**
 * Get parsed routes and stops from cached GeoJSON.
 * Returns null if not cached.
 */
export function getParsedCachedData(): {
  routes: GeoJSONRoute[];
  stops: GeoJSONStop[];
} | null {
  if (!cachedGeoJSON) {
    return null;
  }

  const routes: GeoJSONRoute[] = [];
  const stops: GeoJSONStop[] = [];

  for (const feature of cachedGeoJSON.features) {
    if (feature.geometry.type === "LineString") {
      routes.push(feature as GeoJSONRoute);
    } else if (feature.geometry.type === "Point") {
      stops.push(feature as GeoJSONStop);
    }
  }

  return { routes, stops };
}

/**
 * Clear all cached data (useful for testing or manual refresh).
 */
export function clearRouteCache(): void {
  cachedGeoJSON = null;
  cachedRouteData = null;
  cachedRouteStops = new Map();
  fetchPromise = null;
}
