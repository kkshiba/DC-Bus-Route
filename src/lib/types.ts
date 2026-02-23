// GeoJSON Types for Bus Routes

export interface Coordinates {
  lat: number;
  lng: number;
}

// GeoJSON Route Feature (LineString)
export interface GeoJSONRoute {
  type: "Feature";
  properties: {
    routeId: string;
    routeName: string;
    color: string;
    description?: string;
  };
  geometry: {
    type: "LineString";
    coordinates: [number, number][]; // [lng, lat] pairs (GeoJSON standard)
  };
}

// GeoJSON Stop Feature (Point)
export interface GeoJSONStop {
  type: "Feature";
  properties: {
    stopId: string;
    stopName: string;
    routeIds: string[]; // Routes that pass through this stop
    order: number; // Order within a route
    description?: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat] (GeoJSON standard)
  };
}

// GeoJSON FeatureCollection
export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: (GeoJSONRoute | GeoJSONStop)[];
}

// Walking transfer info between segments
export interface WalkingTransfer {
  fromStop: GeoJSONStop;
  toStop: GeoJSONStop;
  distanceMeters: number;
}

// Route Segment (one leg of a journey)
export interface RouteSegment {
  routeId: string;
  routeName: string;
  routeColor: string;
  boardingStop: GeoJSONStop;
  alightingStop: GeoJSONStop;
  intermediateStops: GeoJSONStop[];
  stopsCount: number;
  distanceKm: number;
  walkToNextStop?: WalkingTransfer; // Walking transfer to next segment (if any)
}

// Complete Route Result
export interface RouteResult {
  type: "single" | "transfer";
  segments: RouteSegment[];
  totalStops: number;
  totalDistanceKm: number;
  transferPoints: GeoJSONStop[]; // Stops where user transfers
  estimatedDuration?: number; // In minutes
}

// Search Request
export interface RouteSearchRequest {
  origin: Coordinates;
  destination: Coordinates;
  maxTransfers?: number; // Default 1 (double ride)
}

// Parsed route data for algorithm use
export interface ParsedRouteData {
  routes: Map<string, GeoJSONRoute>;
  stops: Map<string, GeoJSONStop>;
  routeStops: Map<string, GeoJSONStop[]>; // routeId -> ordered stops
  stopRoutes: Map<string, string[]>; // stopId -> routeIds
  stopAreas: Map<string, Set<string>>; // stopId -> areas (Toril, Mintal, etc.)
}
