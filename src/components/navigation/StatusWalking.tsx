"use client";

import { Footprints, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigationStore } from "@/stores/navigation-store";
import { formatDistance } from "@/lib/geo-utils";

export function StatusWalking() {
  const {
    session,
    walkingDistanceToFirstStop,
    markAtStop,
    getCurrentMilestone,
  } = useNavigationStore();

  const currentMilestone = getCurrentMilestone();

  if (!session || !currentMilestone) {
    return null;
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Icon */}
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Footprints className="w-12 h-12 text-blue-600 dark:text-blue-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Walk to your boarding stop
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Head to the stop below to catch your bus
          </p>
        </div>

        {/* Stop Info Card */}
        <div className="w-full max-w-sm p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: currentMilestone.routeColor + "20" }}
            >
              <MapPin
                className="w-6 h-6"
                style={{ color: currentMilestone.routeColor }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                {currentMilestone.stopName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentMilestone.routeName}
              </p>
              {walkingDistanceToFirstStop > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <Navigation className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {formatDistance(walkingDistanceToFirstStop)} away
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-4">
        <Button
          onClick={markAtStop}
          className="w-full h-14 text-lg font-semibold bg-green-600 hover:bg-green-700"
        >
          I&apos;m at the Stop
        </Button>
      </div>
    </div>
  );
}
