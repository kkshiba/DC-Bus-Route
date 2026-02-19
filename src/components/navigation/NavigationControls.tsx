"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigationStore } from "@/stores/navigation-store";
import { Button } from "@/components/ui/button";
import { MapPin, Bus, X, CheckCircle, ArrowRight } from "lucide-react";

export function NavigationControls() {
  const router = useRouter();
  const session = useNavigationStore((state) => state.session);
  const advanceToNextMilestone = useNavigationStore((state) => state.advanceToNextMilestone);
  const setStatus = useNavigationStore((state) => state.setStatus);
  const cancelNavigation = useNavigationStore((state) => state.cancelNavigation);
  const reset = useNavigationStore((state) => state.reset);
  const getCurrentMilestone = useNavigationStore((state) => state.getCurrentMilestone);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!session) return null;

  const currentMilestone = getCurrentMilestone();
  const { status } = session;

  const handleCancel = () => {
    cancelNavigation();
    setShowCancelConfirm(false);
  };

  const handleEndTrip = () => {
    reset();
    router.push("/");
  };

  // Show different controls based on status
  if (status === "completed") {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center mb-4">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            You have arrived at your destination!
          </p>
        </div>
        <Button onClick={handleEndTrip} className="w-full" variant="default">
          End Trip
        </Button>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
          Navigation was cancelled
        </p>
        <Button onClick={handleEndTrip} className="w-full" variant="default">
          Return Home
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      {showCancelConfirm ? (
        <div className="space-y-3">
          <p className="text-center text-gray-700 dark:text-gray-300">
            Are you sure you want to cancel navigation?
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => setShowCancelConfirm(false)}
              variant="outline"
              className="flex-1"
            >
              Continue
            </Button>
            <Button
              onClick={handleCancel}
              variant="destructive"
              className="flex-1"
            >
              Cancel Trip
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Context-aware action button */}
          {status === "walking_to_stop" && (
            <Button
              onClick={() => setStatus("waiting_for_bus")}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <MapPin className="w-5 h-5 mr-2" />
              I am at the stop
            </Button>
          )}

          {status === "waiting_for_bus" && (
            <Button
              onClick={advanceToNextMilestone}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Bus className="w-5 h-5 mr-2" />
              I boarded the bus
            </Button>
          )}

          {status === "riding" && currentMilestone && (
            <Button
              onClick={advanceToNextMilestone}
              className="w-full bg-primary-600 hover:bg-primary-700"
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              {currentMilestone.type === "alighting"
                ? "I got off the bus"
                : currentMilestone.type === "transfer"
                ? "Arrived at transfer stop"
                : "Next stop"}
            </Button>
          )}

          {status === "transferring" && (
            <Button
              onClick={() => setStatus("waiting_for_bus")}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <MapPin className="w-5 h-5 mr-2" />
              I am at the transfer stop
            </Button>
          )}

          {/* Cancel button */}
          <Button
            onClick={() => setShowCancelConfirm(true)}
            variant="outline"
            className="w-full text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <X className="w-5 h-5 mr-2" />
            Cancel Navigation
          </Button>
        </div>
      )}
    </div>
  );
}
