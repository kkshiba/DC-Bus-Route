"use client";

import { useState, useEffect } from "react";
import { Clock, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigationStore } from "@/stores/navigation-store";

export function StatusWaiting() {
  const {
    session,
    waitingStartedAt,
    markOnBus,
    getCurrentRide,
  } = useNavigationStore();

  const [waitingTime, setWaitingTime] = useState(0);
  const currentRide = getCurrentRide();

  // Update waiting timer every second
  useEffect(() => {
    if (!waitingStartedAt) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - waitingStartedAt.getTime()) / 1000);
      setWaitingTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [waitingStartedAt]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!session || !currentRide) {
    return null;
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Icon */}
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-24 h-24 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
          <Clock className="w-12 h-12 text-yellow-600 dark:text-yellow-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Waiting for bus
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Your bus should arrive soon
          </p>
        </div>

        {/* Route Info Card */}
        <div className="w-full max-w-sm p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: currentRide.routeColor + "20" }}
            >
              <Bus
                className="w-6 h-6"
                style={{ color: currentRide.routeColor }}
              />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {currentRide.routeName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Look for this bus
              </p>
            </div>
            <div
              className="w-4 h-8 rounded"
              style={{ backgroundColor: currentRide.routeColor }}
              title="Bus color indicator"
            />
          </div>
        </div>

        {/* Waiting Timer */}
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Waiting time
          </p>
          <p className="text-3xl font-mono font-bold text-gray-900 dark:text-gray-100">
            {formatTime(waitingTime)}
          </p>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-4">
        <Button
          onClick={markOnBus}
          className="w-full h-14 text-lg font-semibold bg-primary-600 hover:bg-primary-700"
        >
          <Bus className="w-5 h-5 mr-2" />
          I&apos;m on the Bus
        </Button>
      </div>
    </div>
  );
}
