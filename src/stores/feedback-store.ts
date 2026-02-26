import { create } from "zustand";
import { TripData } from "@/lib/feedback.types";

interface FeedbackStore {
  // Modal state
  isModalOpen: boolean;
  tripData: TripData | null;

  // Submission state
  isSubmitting: boolean;
  hasSubmitted: boolean;

  // Actions
  openFeedbackModal: (tripData: TripData) => void;
  closeFeedbackModal: () => void;
  setSubmitting: (submitting: boolean) => void;
  markSubmitted: () => void;
  reset: () => void;
}

export const useFeedbackStore = create<FeedbackStore>((set) => ({
  // Initial state
  isModalOpen: false,
  tripData: null,
  isSubmitting: false,
  hasSubmitted: false,

  // Actions
  openFeedbackModal: (tripData) => {
    set({ isModalOpen: true, tripData, hasSubmitted: false });
  },

  closeFeedbackModal: () => {
    set({ isModalOpen: false });
  },

  setSubmitting: (submitting) => {
    set({ isSubmitting: submitting });
  },

  markSubmitted: () => {
    set({ hasSubmitted: true, isModalOpen: false });
  },

  reset: () => {
    set({
      isModalOpen: false,
      tripData: null,
      isSubmitting: false,
      hasSubmitted: false,
    });
  },
}));
