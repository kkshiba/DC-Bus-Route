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
import { estimateDuration } from "@/lib/geo-utils";

interface NavigationStore {
  // State
  session: NavigationSession | null;
  isNavigating: boolean;

  // Actions
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
}

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  // Initial state
  session: null,
  isNavigating: false,

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
}));
