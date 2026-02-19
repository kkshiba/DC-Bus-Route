"use client";

import { PartyPopper, MapPin, Clock, Bus, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigationStore } from "@/stores/navigation-store";
import { useRouter } from "next/navigation";

export function StatusCompleted() {
  const router = useRouter();
  const { session, waitingStartedAt, reset } = useNavigationStore();

  if (!session) {
    return null;
  }

  const destination = session.selectedRoute.segments.at(-1)?.alightingStop;
  const totalRides = session.selectedRoute.segments.length;

  // Calculate total waiting time (rough estimate)
  const startTime = session.startedAt;
  const endTime = new Date();
  const totalMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  const handleStartNewTrip = () => {
    reset();
  };

  const handleGoHome = () => {
    reset();
    router.push("/");
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Icon */}
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-bounce">
          <PartyPopper className="w-12 h-12 text-green-600 dark:text-green-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            You&apos;ve arrived!
          </h2>
          {destination && (
            <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
              <MapPin className="w-5 h-5 text-green-500" />
              <span className="text-lg">{destination.properties.stopName}</span>
            </div>
          )}
        </div>

        {/* Trip Summary Card */}
        <div className="w-full max-w-sm p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 text-center">
            Trip Summary
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Trip duration */}
            <div className="text-center p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <Clock className="w-6 h-6 text-primary-600 dark:text-primary-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalMinutes}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                minutes
              </p>
            </div>

            {/* Rides taken */}
            <div className="text-center p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <Bus className="w-6 h-6 text-primary-600 dark:text-primary-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalRides}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ride{totalRides !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Thank you message */}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Thank you for riding with DC Bus!
        </p>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 space-y-3">
        <Button
          onClick={handleStartNewTrip}
          className="w-full h-14 text-lg font-semibold bg-primary-600 hover:bg-primary-700"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Start New Trip
        </Button>
        <Button
          onClick={handleGoHome}
          variant="outline"
          className="w-full h-12"
        >
          <Home className="w-5 h-5 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}
