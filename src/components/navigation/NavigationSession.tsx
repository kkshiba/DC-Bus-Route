"use client";

import { X, Bus } from "lucide-react";
import { useNavigationStore } from "@/stores/navigation-store";
import { StatusWalking } from "./StatusWalking";
import { StatusWaiting } from "./StatusWaiting";
import { StatusRiding } from "./StatusRiding";
import { StatusTransfer } from "./StatusTransfer";
import { StatusCompleted } from "./StatusCompleted";

export function NavigationSession() {
  const {
    session,
    cancelNavigation,
    reset,
    getProgress,
    getCurrentRide,
  } = useNavigationStore();

  const progress = getProgress();
  const currentRide = getCurrentRide();

  if (!session) {
    return null;
  }

  const handleCancel = () => {
    if (window.confirm("Are you sure you want to end this trip?")) {
      cancelNavigation();
      reset();
    }
  };

  const renderStatusView = () => {
    switch (session.status) {
      case "walking_to_stop":
        return <StatusWalking />;
      case "waiting_for_bus":
        return <StatusWaiting />;
      case "riding":
        return <StatusRiding />;
      case "transferring":
        return <StatusTransfer />;
      case "completed":
        return <StatusCompleted />;
      case "cancelled":
        return <StatusCompleted />;
      default:
        return <StatusWalking />;
    }
  };

  if (session.status === "completed" || session.status === "cancelled") {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        {renderStatusView()}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header — fixed at top, never clipped */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentRide && (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: currentRide.routeColor + "20" }}
              >
                <Bus
                  className="w-5 h-5"
                  style={{ color: currentRide.routeColor }}
                />
              </div>
            )}
            <div>
              <h1 className="font-semibold text-gray-900 dark:text-gray-100">
                {currentRide?.routeName || "Navigation"}
              </h1>
              {progress.total > 1 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ride {progress.current} of {progress.total}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleCancel}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="End trip"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Status Content — scrollable so nothing gets clipped */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {renderStatusView()}
      </div>
    </div>
  );
}