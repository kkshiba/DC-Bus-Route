"use client";

import { Bus, MapPin, CircleDot, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigationStore } from "@/stores/navigation-store";

export function StatusRiding() {
  const {
    session,
    currentRideIndex,
    markDroppedOff,
    getCurrentRide,
    getDropOffStop,
    getRemainingMilestones,
  } = useNavigationStore();

  const currentRide = getCurrentRide();
  const dropOffStop = getDropOffStop();
  const remainingMilestones = getRemainingMilestones();

  if (!session || !currentRide) {
    return null;
  }

  // Filter remaining stops for current route only
  const upcomingStops = remainingMilestones.filter(
    (m) => m.routeId === currentRide.routeId
  );

  // Find how many stops until drop-off
  const dropOffIndex = upcomingStops.findIndex(
    (m) => dropOffStop && m.stopId === dropOffStop.stopId
  );
  const stopsRemaining = dropOffIndex >= 0 ? dropOffIndex + 1 : upcomingStops.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: currentRide.routeColor + "20" }}
          >
            <Bus className="w-6 h-6" style={{ color: currentRide.routeColor }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              You&apos;re on the bus!
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentRide.routeName}
            </p>
          </div>
        </div>
      </div>

      {/* Drop-off Card */}
      {dropOffStop && (
        <div className="p-4">
          <div
            className="p-4 rounded-2xl border-2"
            style={{
              backgroundColor: currentRide.routeColor + "10",
              borderColor: currentRide.routeColor,
            }}
          >
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Get off at:
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: currentRide.routeColor }}
              >
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3
                  className="text-xl font-bold"
                  style={{ color: currentRide.routeColor }}
                >
                  {dropOffStop.stopName}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {stopsRemaining} stop{stopsRemaining !== 1 ? "s" : ""} remaining
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Stops */}
      <div className="flex-1 overflow-y-auto px-4">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          Upcoming stops
        </p>
        <div className="space-y-1">
          {upcomingStops.map((stop, index) => {
            const isDropOff = dropOffStop && stop.stopId === dropOffStop.stopId;
            const isPast = index < 0;

            return (
              <div
                key={stop.id}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
                  isDropOff
                    ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                    : ""
                }`}
              >
                {/* Timeline indicator */}
                <div className="flex flex-col items-center">
                  {isPast ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : isDropOff ? (
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  ) : (
                    <CircleDot className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                  )}
                </div>

                {/* Stop name */}
                <div className="flex-1">
                  <p
                    className={`text-sm ${
                      isDropOff
                        ? "font-bold text-red-600 dark:text-red-400"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {stop.stopName}
                  </p>
                  {isDropOff && (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      YOUR STOP
                    </p>
                  )}
                </div>

                {/* Next indicator */}
                {index === 0 && !isDropOff && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    next
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Button */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
        <Button
          onClick={markDroppedOff}
          className="w-full h-14 text-lg font-semibold bg-red-600 hover:bg-red-700"
        >
          I&apos;ve Dropped Off
        </Button>
      </div>
    </div>
  );
}
