import { supabase } from "./supabase";
import { TripFeedbackPayload, TripData } from "./feedback.types";
import { NavigationSession } from "./navigation-types";

/**
 * Submit trip feedback to Supabase
 */
export async function submitTripFeedback(
  feedback: TripFeedbackPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("trip_feedback").insert({
      star_rating: feedback.starRating,
      comment: feedback.comment,
      session_id: feedback.sessionId,
      route_ids: feedback.routeIds,
      origin_stop_name: feedback.originStopName,
      destination_stop_name: feedback.destinationStopName,
      trip_duration_minutes: feedback.tripDurationMinutes,
      number_of_rides: feedback.numberOfRides,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });

    if (error) {
      console.error("Error submitting feedback:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Error submitting feedback:", err);
    return { success: false, error: "Failed to submit feedback" };
  }
}

/**
 * Extract trip data from navigation session for feedback payload
 */
export function extractTripDataForFeedback(session: NavigationSession): TripData {
  const segments = session.selectedRoute.segments;
  const now = new Date();

  // Get all route IDs from segments
  const routeIds = segments.map((seg) => seg.routeId);

  // Origin is first boarding stop
  const originStopName =
    segments[0]?.boardingStop.properties.stopName || "Unknown";

  // Destination is last alighting stop
  const destinationStopName =
    segments[segments.length - 1]?.alightingStop.properties.stopName || "Unknown";

  // Calculate trip duration
  const tripDurationMinutes = Math.round(
    (now.getTime() - session.startedAt.getTime()) / 60000
  );

  return {
    sessionId: session.id,
    routeIds,
    originStopName,
    destinationStopName,
    tripDurationMinutes,
    numberOfRides: segments.length,
  };
}
