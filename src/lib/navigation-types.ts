import { Coordinates, RouteResult, GeoJSONStop } from "./types";

/**
 * Navigation status states representing the user's current activity
 */
export type NavigationStatus =
  | "walking_to_stop" // User walking to boarding stop
  | "waiting_for_bus" // At stop, waiting for bus
  | "riding" // On the bus
  | "transferring" // Walking to transfer stop
  | "completed" // Reached destination
  | "cancelled"; // Navigation was cancelled

/**
 * Milestone types for different points in the journey
 */
export type MilestoneType = "boarding" | "intermediate" | "transfer" | "alighting";

/**
 * A navigation milestone represents a significant point in the journey
 */
export interface NavigationMilestone {
  id: string;
  stopId: string;
  stopName: string;
  type: MilestoneType;
  coordinates: Coordinates;
  routeId: string;
  routeName: string;
  routeColor: string;
  order: number;
  completed: boolean;
  completedAt?: Date;
}

/**
 * A navigation session tracks the user's journey from start to finish
 */
export interface NavigationSession {
  id: string;
  status: NavigationStatus;
  selectedRoute: RouteResult;
  milestones: NavigationMilestone[];
  currentMilestoneIndex: number;
  userLocation: Coordinates | null;
  startedAt: Date;
  estimatedArrival: Date | null;
  distanceRemaining: number;
}

/**
 * Location tracking state
 */
export interface LocationTrackingState {
  location: Coordinates | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  error: string | null;
  isTracking: boolean;
}

/**
 * Create milestones from a RouteResult
 */
export function createMilestonesFromRoute(route: RouteResult): NavigationMilestone[] {
  const milestones: NavigationMilestone[] = [];
  let order = 0;

  for (let segmentIndex = 0; segmentIndex < route.segments.length; segmentIndex++) {
    const segment = route.segments[segmentIndex];
    const isFirstSegment = segmentIndex === 0;
    const isLastSegment = segmentIndex === route.segments.length - 1;

    // Boarding stop
    milestones.push({
      id: `milestone-${order}`,
      stopId: segment.boardingStop.properties.stopId,
      stopName: segment.boardingStop.properties.stopName,
      type: isFirstSegment ? "boarding" : "transfer",
      coordinates: {
        lat: segment.boardingStop.geometry.coordinates[1],
        lng: segment.boardingStop.geometry.coordinates[0],
      },
      routeId: segment.routeId,
      routeName: segment.routeName,
      routeColor: segment.routeColor,
      order: order++,
      completed: false,
    });

    // Intermediate stops (optional - can be shown or hidden)
    for (const stop of segment.intermediateStops) {
      milestones.push({
        id: `milestone-${order}`,
        stopId: stop.properties.stopId,
        stopName: stop.properties.stopName,
        type: "intermediate",
        coordinates: {
          lat: stop.geometry.coordinates[1],
          lng: stop.geometry.coordinates[0],
        },
        routeId: segment.routeId,
        routeName: segment.routeName,
        routeColor: segment.routeColor,
        order: order++,
        completed: false,
      });
    }

    // Alighting stop (only for last segment, transfer stops are handled as boarding)
    if (isLastSegment) {
      milestones.push({
        id: `milestone-${order}`,
        stopId: segment.alightingStop.properties.stopId,
        stopName: segment.alightingStop.properties.stopName,
        type: "alighting",
        coordinates: {
          lat: segment.alightingStop.geometry.coordinates[1],
          lng: segment.alightingStop.geometry.coordinates[0],
        },
        routeId: segment.routeId,
        routeName: segment.routeName,
        routeColor: segment.routeColor,
        order: order++,
        completed: false,
      });
    }
  }

  return milestones;
}

/**
 * Get the next status based on current milestone type
 */
export function getStatusForMilestone(
  milestone: NavigationMilestone,
  isCompleted: boolean
): NavigationStatus {
  if (isCompleted && milestone.type === "alighting") {
    return "completed";
  }

  switch (milestone.type) {
    case "boarding":
      return isCompleted ? "riding" : "walking_to_stop";
    case "transfer":
      return isCompleted ? "riding" : "transferring";
    case "intermediate":
      return "riding";
    case "alighting":
      return isCompleted ? "completed" : "riding";
    default:
      return "walking_to_stop";
  }
}

/**
 * Calculate distance remaining based on current milestone
 */
export function calculateDistanceRemaining(
  milestones: NavigationMilestone[],
  currentIndex: number,
  userLocation: Coordinates | null
): number {
  if (currentIndex >= milestones.length) return 0;

  let totalDistance = 0;
  const currentMilestone = milestones[currentIndex];

  // Distance from user to current milestone
  if (userLocation) {
    totalDistance += haversineDistance(userLocation, currentMilestone.coordinates);
  }

  // Distance between remaining milestones
  for (let i = currentIndex; i < milestones.length - 1; i++) {
    totalDistance += haversineDistance(
      milestones[i].coordinates,
      milestones[i + 1].coordinates
    );
  }

  return totalDistance;
}

/**
 * Simple haversine distance calculation (duplicated here for self-containment)
 */
function haversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const EARTH_RADIUS_KM = 6371;
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);

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
 * Check if user is near a milestone (within threshold)
 */
export function isNearMilestone(
  userLocation: Coordinates,
  milestone: NavigationMilestone,
  thresholdKm: number = 0.1 // 100 meters default
): boolean {
  const distance = haversineDistance(userLocation, milestone.coordinates);
  return distance <= thresholdKm;
}
