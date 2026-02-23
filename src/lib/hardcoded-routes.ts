/**
 * Hardcoded route data for reliable algorithm calculations
 * Uses the local JSON files from Routes-dcbus folder
 */

import type { GeoJSONRoute, GeoJSONStop, ParsedRouteData } from "./types";

// Import route JSON files from Routes-dcbus
import R103AM from "../../Routes-dcbus/R103-AM.json";
import R103PM from "../../Routes-dcbus/R103-PM.json";
import R102AM from "../../Routes-dcbus/R102-AM.json";
import R102PM from "../../Routes-dcbus/R102-PM.json";
import R402AM from "../../Routes-dcbus/R402-AM.json";
import R402PM from "../../Routes-dcbus/R402-PM.json";
import R403AM from "../../Routes-dcbus/R403-AM.json";
import R403PM from "../../Routes-dcbus/R403-PM.json";
import R503AM from "../../Routes-dcbus/R503-AM.json";
import R503PM from "../../Routes-dcbus/R503-PM.json";
import R603AM from "../../Routes-dcbus/R603-AM.json";
import R603PM from "../../Routes-dcbus/R603-PM.json";
import R763AM from "../../Routes-dcbus/R763-AM.json";
import R763PM from "../../Routes-dcbus/R763-PM.json";
import R783AM from "../../Routes-dcbus/R783-AM.json";
import R783PM from "../../Routes-dcbus/R783-PM.json";
import R793AM from "../../Routes-dcbus/R793-AM.json";
import R793PM from "../../Routes-dcbus/R793-PM.json";

interface RoutePoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  kind: string; // "stop" or "waypoint"
  heading: number;
}

interface RouteFile {
  id: string;
  route_number: string;
  name: string;
  area: string;
  time_period: string;
  color: string;
  start_time: string;
  end_time: string;
  points: RoutePoint[];
}

// Cast to RouteFile[] to handle JSON import typing
const allRouteFiles = [
  R103AM, R103PM, R102AM, R102PM,
  R402AM, R402PM, R403AM, R403PM,
  R503AM, R503PM, R603AM, R603PM,
  R763AM, R763PM, R783AM, R783PM,
  R793AM, R793PM,
] as RouteFile[];

/**
 * Normalize stop name to create consistent ID
 * This fixes the issue where same stops have different UUIDs in different route files
 */
function normalizeStopId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Build route data once
function buildRouteData(): ParsedRouteData {
  const routes = new Map<string, GeoJSONRoute>();
  const stops = new Map<string, GeoJSONStop>();
  const routeStops = new Map<string, GeoJSONStop[]>();
  const stopRoutes = new Map<string, string[]>();
  const stopAreas = new Map<string, Set<string>>(); // NEW: stopId -> areas

  // First pass: collect which routes each stop is on AND which areas
  // KEY FIX: Use normalized stop name as ID instead of UUID
  const stopToRoutes = new Map<string, Set<string>>();
  const stopInfo = new Map<string, { name: string; lat: number; lng: number }>();

  for (const routeFile of allRouteFiles) {
    const routeId = `${routeFile.route_number}-${routeFile.time_period}`;
    const area = routeFile.area; // Get area from route file
    for (const point of routeFile.points) {
      if (point.kind === "stop" && point.name) {
        const normalizedId = normalizeStopId(point.name);
        if (!stopToRoutes.has(normalizedId)) {
          stopToRoutes.set(normalizedId, new Set());
          stopInfo.set(normalizedId, {
            name: point.name,
            lat: point.latitude,
            lng: point.longitude,
          });
        }
        stopToRoutes.get(normalizedId)!.add(routeId);

        // Collect areas for each stop
        if (!stopAreas.has(normalizedId)) {
          stopAreas.set(normalizedId, new Set());
        }
        stopAreas.get(normalizedId)!.add(area);
      }
    }
  }

  // Second pass: build all data structures
  for (const routeFile of allRouteFiles) {
    const routeId = `${routeFile.route_number}-${routeFile.time_period}`;

    // Build route coordinates
    const coordinates: [number, number][] = routeFile.points.map(
      (p) => [p.longitude, p.latitude]
    );

    // Create route
    routes.set(routeId, {
      type: "Feature",
      properties: {
        routeId,
        routeName: `${routeFile.route_number} - ${routeFile.name}`,
        color: routeFile.color,
        description: `${routeFile.area} (${routeFile.time_period})`,
      },
      geometry: { type: "LineString", coordinates },
    });

    // Build stops for this route
    const routeStopList: GeoJSONStop[] = [];
    let stopOrder = 0;

    for (const point of routeFile.points) {
      if (point.kind === "stop" && point.name) {
        stopOrder++;
        // KEY FIX: Use normalized ID based on name
        const normalizedId = normalizeStopId(point.name);
        const routeIds = Array.from(stopToRoutes.get(normalizedId) || []);

        const stop: GeoJSONStop = {
          type: "Feature",
          properties: {
            stopId: normalizedId, // Use normalized ID
            stopName: point.name,
            routeIds, // Now correctly includes ALL routes this stop is on!
            order: stopOrder,
          },
          geometry: {
            type: "Point",
            coordinates: [point.longitude, point.latitude],
          },
        };

        stops.set(normalizedId, stop);
        routeStopList.push(stop);
        stopRoutes.set(normalizedId, routeIds);
      }
    }

    routeStops.set(routeId, routeStopList);
  }

  return { routes, stops, routeStops, stopRoutes, stopAreas };
}

let cachedData: ParsedRouteData | null = null;

export function getHardcodedRouteData(): ParsedRouteData {
  if (!cachedData) {
    cachedData = buildRouteData();
  }
  return cachedData;
}
