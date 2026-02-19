import { create } from "zustand";
import { Coordinates, RouteResult } from "@/lib/types";
import {
  NavigationSession,
  NavigationStatus,
  NavigationMilestone,
  createMilestonesFromRoute,
  getStatusForMilestone,
  calculateDistanceRemaining,
  isNearMilestone,
} from "@/lib/navigation-types";
import { estimateDuration, haversineDistance } from "@/lib/geo-utils";

// Extended location type with optional name
export interface NamedLocation extends Coordinates {
  name?: string;
}

// Planning flow status
export type PlanningStatus = "idle" | "planning" | "selecting" | "navigating";

interface NavigationStore {
  // Trip Planning State
  planningStatus: PlanningStatus;
  origin: NamedLocation | null;
  destination: NamedLocation | null;
  routeOptions: RouteResult[];
  walkingDistanceToFirstStop: number;
  waitingStartedAt: Date | null;
  currentRideIndex: number;

  // Navigation State
  session: NavigationSession | null;
  isNavigating: boolean;

  // Trip Planning Actions
  setOrigin: (location: NamedLocation) => void;
  setDestination: (location: NamedLocation) => void;
  setRouteOptions: (options: RouteResult[]) => void;
  selectRoute: (route: RouteResult) => void;
  setPlanningStatus: (status: PlanningStatus) => void;

  // Milestone-based Status Updates
  markAtStop: () => void;
  markOnBus: () => void;
  markDroppedOff: () => void;
  markAtTransfer: () => void;

  // Core Navigation Actions
  startNavigation: (route: RouteResult) => void;
  updateLocation: (coords: Coordinates) => void;
  completeMilestone: (milestoneId: string) => void;
  advanceToNextMilestone: () => void;
  setStatus: (status: NavigationStatus) => void;
  cancelNavigation: () => void;
  reset: () => void;

  // Computed getters (as functions)
  getCurrentMilestone: () => NavigationMilestone | null;
  getNextMilestone: () => NavigationMilestone | null;
  getRemainingMilestones: () => NavigationMilestone[];
  getCompletedMilestones: () => NavigationMilestone[];
  getCurrentRide: () => { routeId: string; routeName: string; routeColor: string } | null;
  getDropOffStop: () => NavigationMilestone | null;
  getProgress: () => { current: number; total: number };
}

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  // Initial state - Trip Planning
  planningStatus: "idle",
  origin: null,
  destination: null,
  routeOptions: [],
  walkingDistanceToFirstStop: 0,
  waitingStartedAt: null,
  currentRideIndex: 0,

  // Initial state - Navigation
  session: null,
  isNavigating: false,

  // Trip Planning Actions
  setOrigin: (location: NamedLocation) => {
    set({ origin: location });
  },

  setDestination: (location: NamedLocation) => {
    set({ destination: location });
  },

  setRouteOptions: (options: RouteResult[]) => {
    set({ routeOptions: options, planningStatus: "selecting" });
  },

  setPlanningStatus: (status: PlanningStatus) => {
    set({ planningStatus: status });
  },

  selectRoute: (route: RouteResult) => {
    const { origin } = get();
    let walkingDistance = 0;

    // Calculate walking distance to first stop
    if (origin && route.segments.length > 0) {
      const firstStop = route.segments[0].boardingStop;
      walkingDistance = haversineDistance(origin, {
        lat: firstStop.geometry.coordinates[1],
        lng: firstStop.geometry.coordinates[0],
      });
    }

    set({
      walkingDistanceToFirstStop: walkingDistance,
      currentRideIndex: 0,
      planningStatus: "navigating",
    });

    // Start navigation with the selected route
    get().startNavigation(route);
  },

  // Milestone-based Status Updates
  markAtStop: () => {
    const { session } = get();
    if (!session) return;

    set({
      session: {
        ...session,
        status: "waiting_for_bus",
      },
      waitingStartedAt: new Date(),
    });
  },

  markOnBus: () => {
    const { session } = get();
    if (!session) return;

    set({
      session: {
        ...session,
        status: "riding",
      },
      waitingStartedAt: null,
    });
  },

  markDroppedOff: () => {
    const { session, currentRideIndex } = get();
    if (!session) return;

    const totalRides = session.selectedRoute.segments.length;
    const isLastRide = currentRideIndex >= totalRides - 1;

    if (isLastRide) {
      // Completed journey
      set({
        session: {
          ...session,
          status: "completed",
        },
        isNavigating: false,
      });
    } else {
      // Need to transfer to next ride
      set({
        session: {
          ...session,
          status: "transferring",
        },
        currentRideIndex: currentRideIndex + 1,
      });
    }
  },

  markAtTransfer: () => {
    const { session } = get();
    if (!session) return;

    set({
      session: {
        ...session,
        status: "waiting_for_bus",
      },
      waitingStartedAt: new Date(),
    });
  },

  // Start a new navigation session
  startNavigation: (route: RouteResult) => {
    const milestones = createMilestonesFromRoute(route);
    const now = new Date();

    // Estimate arrival time based on total distance
    const estimatedMinutes = estimateDuration(route.totalDistanceKm);
    const estimatedArrival = new Date(now.getTime() + estimatedMinutes * 60 * 1000);

    const session: NavigationSession = {
      id: `nav-${Date.now()}`,
      status: "walking_to_stop",
      selectedRoute: route,
      milestones,
      currentMilestoneIndex: 0,
      userLocation: null,
      startedAt: now,
      estimatedArrival,
      distanceRemaining: route.totalDistanceKm,
    };

    set({ session, isNavigating: true });
  },

  // Update user location and check for milestone proximity
  updateLocation: (coords: Coordinates) => {
    const { session } = get();
    if (!session) return;

    const currentMilestone = session.milestones[session.currentMilestoneIndex];
    const distanceRemaining = calculateDistanceRemaining(
      session.milestones,
      session.currentMilestoneIndex,
      coords
    );

    // Check if near current milestone (auto-complete if within 100m)
    if (currentMilestone && isNearMilestone(coords, currentMilestone, 0.1)) {
      // Auto-advance for intermediate stops, manual confirmation for boarding/alighting
      if (currentMilestone.type === "intermediate") {
        get().completeMilestone(currentMilestone.id);
      }
    }

    set({
      session: {
        ...session,
        userLocation: coords,
        distanceRemaining,
      },
    });
  },

  // Mark a milestone as completed
  completeMilestone: (milestoneId: string) => {
    const { session } = get();
    if (!session) return;

    const updatedMilestones = session.milestones.map((m) =>
      m.id === milestoneId
        ? { ...m, completed: true, completedAt: new Date() }
        : m
    );

    const completedIndex = session.milestones.findIndex((m) => m.id === milestoneId);
    const nextIndex = completedIndex + 1;
    const nextMilestone = updatedMilestones[nextIndex];

    // Determine new status based on completed milestone
    const completedMilestone = session.milestones[completedIndex];
    const newStatus = nextMilestone
      ? getStatusForMilestone(completedMilestone, true)
      : "completed";

    set({
      session: {
        ...session,
        milestones: updatedMilestones,
        currentMilestoneIndex: Math.min(nextIndex, session.milestones.length - 1),
        status: newStatus,
      },
    });
  },

  // Advance to the next milestone
  advanceToNextMilestone: () => {
    const { session } = get();
    if (!session) return;

    const currentMilestone = session.milestones[session.currentMilestoneIndex];
    if (currentMilestone) {
      get().completeMilestone(currentMilestone.id);
    }
  },

  // Manually set navigation status
  setStatus: (status: NavigationStatus) => {
    const { session } = get();
    if (!session) return;

    set({
      session: {
        ...session,
        status,
      },
    });
  },

  // Cancel the current navigation
  cancelNavigation: () => {
    const { session } = get();
    if (!session) return;

    set({
      session: {
        ...session,
        status: "cancelled",
      },
      isNavigating: false,
    });
  },

  // Reset all navigation state
  reset: () => {
    set({
      planningStatus: "idle",
      origin: null,
      destination: null,
      routeOptions: [],
      walkingDistanceToFirstStop: 0,
      waitingStartedAt: null,
      currentRideIndex: 0,
      session: null,
      isNavigating: false,
    });
  },

  // Get the current milestone
  getCurrentMilestone: () => {
    const { session } = get();
    if (!session) return null;
    return session.milestones[session.currentMilestoneIndex] || null;
  },

  // Get the next milestone after current
  getNextMilestone: () => {
    const { session } = get();
    if (!session) return null;
    return session.milestones[session.currentMilestoneIndex + 1] || null;
  },

  // Get all remaining (incomplete) milestones
  getRemainingMilestones: () => {
    const { session } = get();
    if (!session) return [];
    return session.milestones.filter((m) => !m.completed);
  },

  // Get all completed milestones
  getCompletedMilestones: () => {
    const { session } = get();
    if (!session) return [];
    return session.milestones.filter((m) => m.completed);
  },

  // Get current ride info
  getCurrentRide: () => {
    const { session, currentRideIndex } = get();
    if (!session) return null;
    const segment = session.selectedRoute.segments[currentRideIndex];
    if (!segment) return null;
    return {
      routeId: segment.routeId,
      routeName: segment.routeName,
      routeColor: segment.routeColor,
    };
  },

  // Get the drop-off stop for current ride
  getDropOffStop: () => {
    const { session, currentRideIndex } = get();
    if (!session) return null;
    const segment = session.selectedRoute.segments[currentRideIndex];
    if (!segment) return null;

    // Find the alighting milestone for this segment
    const alightingStop = session.milestones.find(
      (m) =>
        m.type === "alighting" ||
        (m.type === "transfer" && m.routeId === segment.routeId &&
         m.stopId === segment.alightingStop.properties.stopId)
    );

    // If no explicit alighting, look for the last stop on this route segment
    if (!alightingStop) {
      return session.milestones.find(
        (m) => m.stopId === segment.alightingStop.properties.stopId
      ) || null;
    }

    return alightingStop;
  },

  // Get progress through multi-ride trip
  getProgress: () => {
    const { session, currentRideIndex } = get();
    if (!session) return { current: 0, total: 0 };
    return {
      current: currentRideIndex + 1,
      total: session.selectedRoute.segments.length,
    };
  },
}));
