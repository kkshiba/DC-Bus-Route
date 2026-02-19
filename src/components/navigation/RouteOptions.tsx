"use client";

import { ArrowLeft, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteCard } from "./RouteCard";
import { useNavigationStore } from "@/stores/navigation-store";
import { haversineDistance } from "@/lib/geo-utils";

export function RouteOptions() {
  const {
    origin,
    routeOptions,
    selectRoute,
    reset,
  } = useNavigationStore();

  // Calculate walking distance to first stop for each route
  const getWalkingDistance = (routeIndex: number) => {
    const route = routeOptions[routeIndex];
    if (!origin || !route || route.segments.length === 0) return 0;

    const firstStop = route.segments[0].boardingStop;
    return haversineDistance(origin, {
      lat: firstStop.geometry.coordinates[1],
      lng: firstStop.geometry.coordinates[0],
    });
  };

  if (routeOptions.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Route className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          No Routes Found
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          We could not find any routes between your selected locations. Try different stops.
        </p>
        <Button onClick={reset} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Choose a Route
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {routeOptions.length} route{routeOptions.length !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>
      </div>

      {/* Route Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {routeOptions.map((route, index) => (
          <RouteCard
            key={`route-${index}`}
            route={route}
            walkingDistance={getWalkingDistance(index)}
            onSelect={() => selectRoute(route)}
          />
        ))}
      </div>
    </div>
  );
}
