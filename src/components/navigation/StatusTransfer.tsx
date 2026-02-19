"use client";

import { RefreshCw, MapPin, Bus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigationStore } from "@/stores/navigation-store";

export function StatusTransfer() {
  const {
    session,
    currentRideIndex,
    markAtTransfer,
  } = useNavigationStore();

  if (!session) {
    return null;
  }

  // Get the next segment (the one we're transferring to)
  const nextSegment = session.selectedRoute.segments[currentRideIndex];

  if (!nextSegment) {
    return null;
  }

  const transferStop = nextSegment.boardingStop;

  return (
    <div className="flex flex-col h-full p-6">
      {/* Icon */}
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-24 h-24 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <RefreshCw className="w-12 h-12 text-orange-600 dark:text-orange-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Transfer to next bus
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Walk to the transfer stop for your next ride
          </p>
        </div>

        {/* Transfer Info Card */}
        <div className="w-full max-w-sm p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          {/* Transfer stop */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Walk to:
              </p>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {transferStop.properties.stopName}
              </h3>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
          </div>

          {/* Next route */}
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: nextSegment.routeColor + "20" }}
            >
              <Bus
                className="w-5 h-5"
                style={{ color: nextSegment.routeColor }}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Next route:
              </p>
              <h3
                className="font-semibold"
                style={{ color: nextSegment.routeColor }}
              >
                {nextSegment.routeName}
              </h3>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Ride {currentRideIndex + 1} of {session.selectedRoute.segments.length}
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-4">
        <Button
          onClick={markAtTransfer}
          className="w-full h-14 text-lg font-semibold bg-orange-600 hover:bg-orange-700"
        >
          I&apos;m at Transfer Stop
        </Button>
      </div>
    </div>
  );
}
