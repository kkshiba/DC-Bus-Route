// Trip feedback type definitions

// Feedback payload for submission to Supabase
export interface TripFeedbackPayload {
  starRating: number;
  comment: string | null;
  sessionId: string;
  routeIds: string[];
  originStopName: string;
  destinationStopName: string;
  tripDurationMinutes: number;
  numberOfRides: number;
}

// Trip data extracted from navigation session (before user provides rating)
export type TripData = Omit<TripFeedbackPayload, "starRating" | "comment">;

// Database row type (matches Supabase schema)
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
