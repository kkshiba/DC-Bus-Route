// Database row types (matching Supabase schema)

export interface DbRoute {
  id: string;
  route_id: string;
  route_name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export interface DbRouteWithCoordinates extends DbRoute {
  geojson: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

export interface DbStop {
  id: string;
  stop_id: string;
  stop_name: string;
  description: string | null;
  created_at: string;
}

export interface DbStopWithRoutes {
  id: string;
  stop_id: string;
  stop_name: string;
  description: string | null;
  lat: number;
  lng: number;
  route_ids: string[];
}

export interface DbRouteStop {
  id: string;
  route_id: string;
  stop_id: string;
  stop_order: number;
  created_at: string;
}

// RPC function return types
export interface NearestStopResult {
  stop_id: string;
  stop_name: string;
  description: string | null;
  lat: number;
  lng: number;
  distance_meters: number;
  route_ids: string[];
}

export interface RouteStopResult {
  stop_id: string;
  stop_name: string;
  description: string | null;
  lat: number;
  lng: number;
  stop_order: number;
  route_ids: string[];
}

// Trip feedback table
export interface DbTripFeedback {
  id: string;
  star_rating: number;
  comment: string | null;
  session_id: string;
  route_ids: string[];
  origin_stop_name: string;
  destination_stop_name: string;
  trip_duration_minutes: number;
  number_of_rides: number;
  submitted_at: string;
  user_agent: string | null;
}
