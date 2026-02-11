import { Coordinates, GeoJSONStop } from "./types";

const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function haversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) *
      Math.cos(toRadians(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Convert GeoJSON coordinates [lng, lat] to Coordinates object {lat, lng}
 */
export function geoJSONToCoordinates(geoCoords: [number, number]): Coordinates {
  return {
    lng: geoCoords[0],
    lat: geoCoords[1],
  };
}

/**
 * Convert Coordinates object {lat, lng} to GeoJSON [lng, lat]
 */
export function coordinatesToGeoJSON(coords: Coordinates): [number, number] {
  return [coords.lng, coords.lat];
}

/**
 * Get coordinates from a GeoJSON stop
 */
export function getStopCoordinates(stop: GeoJSONStop): Coordinates {
  return geoJSONToCoordinates(stop.geometry.coordinates);
}

/**
 * Find the nearest stop to a given location
 */
export function findNearestStop(
  location: Coordinates,
  stops: GeoJSONStop[]
): { stop: GeoJSONStop; distance: number } | null {
  if (stops.length === 0) return null;

  let nearestStop = stops[0];
  let minDistance = haversineDistance(location, getStopCoordinates(stops[0]));

  for (let i = 1; i < stops.length; i++) {
    const distance = haversineDistance(location, getStopCoordinates(stops[i]));
    if (distance < minDistance) {
      minDistance = distance;
      nearestStop = stops[i];
    }
  }

  return { stop: nearestStop, distance: minDistance };
}

/**
 * Find stops within a given radius (in km) from a location
 */
export function findStopsWithinRadius(
  location: Coordinates,
  stops: GeoJSONStop[],
  radiusKm: number
): { stop: GeoJSONStop; distance: number }[] {
  const results: { stop: GeoJSONStop; distance: number }[] = [];

  for (const stop of stops) {
    const distance = haversineDistance(location, getStopCoordinates(stop));
    if (distance <= radiusKm) {
      results.push({ stop, distance });
    }
  }

  // Sort by distance
  return results.sort((a, b) => a.distance - b.distance);
}

/**
 * Calculate total distance along a series of stops
 */
export function calculateRouteDistance(stops: GeoJSONStop[]): number {
  if (stops.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    totalDistance += haversineDistance(
      getStopCoordinates(stops[i]),
      getStopCoordinates(stops[i + 1])
    );
  }

  return totalDistance;
}

/**
 * Estimate travel duration based on distance
 * Assumes average bus speed of 20 km/h in city traffic
 */
export function estimateDuration(distanceKm: number): number {
  const AVG_SPEED_KMH = 20;
  return Math.round((distanceKm / AVG_SPEED_KMH) * 60); // Returns minutes
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
}
