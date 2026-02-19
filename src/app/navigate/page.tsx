"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Map from "@/components/Map";
import {
  NavigationStatusBar,
  MilestonesTimeline,
  NavigationControls,
} from "@/components/navigation";
import { useNavigationStore } from "@/stores/navigation-store";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { loadRouteData, getRawGeoJSON } from "@/lib/data-loader";
import {
  getParsedCachedData,
  getCachedRouteData,
  isRouteDataCached,
} from "@/lib/route-cache";
import { findRoute } from "@/lib/route-algorithm";
import type {
  GeoJSONRoute,
  GeoJSONStop,
  RouteResult,
  Coordinates,
  ParsedRouteData,
} from "@/lib/types";

function NavigateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL params for route finding
  const startLat = searchParams.get("startLat");
  const startLng = searchParams.get("startLng");
  const destLat = searchParams.get("destLat");
  const destLng = searchParams.get("destLng");

  // Navigation store
  const session = useNavigationStore((state) => state.session);
  const isNavigating = useNavigationStore((state) => state.isNavigating);
  const startNavigation = useNavigationStore((state) => state.startNavigation);
  const updateLocation = useNavigationStore((state) => state.updateLocation);
  const reset = useNavigationStore((state) => state.reset);

  // Location tracking
  const {
    location: userLocation,
    error: locationError,
    isTracking,
    startTracking,
    stopTracking,
  } = useLocationTracking({
    onLocationUpdate: updateLocation,
  });

  // Data loading state
  const [routes, setRoutes] = useState<GeoJSONRoute[]>([]);
  const [stops, setStops] = useState<GeoJSONStop[]>([]);
  const [routeData, setRouteData] = useState<ParsedRouteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Found route before starting navigation
  const [foundRoute, setFoundRoute] = useState<RouteResult | null>(null);

  // Load route data
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setLoadError(null);

        // Check cache first
        if (isRouteDataCached()) {
          const cached = getParsedCachedData();
          const cachedRouteData = getCachedRouteData();
          if (cached && cachedRouteData) {
            setRoutes(cached.routes);
            setStops(cached.stops);
            setRouteData(cachedRouteData);
            setIsLoading(false);
            return;
          }
        }

        // Fallback to fetching
        const [geojson, data] = await Promise.all([
          getRawGeoJSON(),
          loadRouteData(),
        ]);

        const fetchedRoutes: GeoJSONRoute[] = [];
        const fetchedStops: GeoJSONStop[] = [];

        for (const feature of geojson.features) {
          if (feature.geometry.type === "LineString") {
            fetchedRoutes.push(feature as GeoJSONRoute);
          } else if (feature.geometry.type === "Point") {
            fetchedStops.push(feature as GeoJSONStop);
          }
        }

        setRoutes(fetchedRoutes);
        setStops(fetchedStops);
        setRouteData(data);
      } catch (error) {
        console.error("Failed to load route data:", error);
        setLoadError("Failed to load route data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Find route from URL params
  useEffect(() => {
    if (!routeData || !startLat || !startLng || !destLat || !destLng) return;

    const origin: Coordinates = {
      lat: parseFloat(startLat),
      lng: parseFloat(startLng),
    };
    const destination: Coordinates = {
      lat: parseFloat(destLat),
      lng: parseFloat(destLng),
    };

    const result = findRoute({ origin, destination }, routeData);
    setFoundRoute(result);
  }, [routeData, startLat, startLng, destLat, destLng]);

  // Start location tracking when navigation begins
  useEffect(() => {
    if (isNavigating && !isTracking) {
      startTracking();
    }
    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, [isNavigating, isTracking, startTracking, stopTracking]);

  // Handle starting navigation
  const handleStartNavigation = useCallback(() => {
    if (foundRoute) {
      startNavigation(foundRoute);
      startTracking();
    }
  }, [foundRoute, startNavigation, startTracking]);

  // Handle going back
  const handleBack = () => {
    reset();
    router.push("/");
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] dark:bg-gray-950">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            Loading navigation data...
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (loadError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] dark:bg-gray-950">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-500">{loadError}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // No route found - show error
  if (!foundRoute && !session) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] dark:bg-gray-950">
        <div className="text-center max-w-md px-4">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
            No Route Found
          </h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            We could not find a route between your selected locations. Please try
            different start and destination points.
          </p>
          <Button onClick={handleBack} className="mt-6">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Pre-navigation state - show route preview and start button
  if (!isNavigating && foundRoute) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Map Preview */}
        <div className="flex-1 relative">
          <Map
            routes={routes}
            stops={stops}
            selectedRoute={foundRoute}
            userLocation={userLocation}
            className="w-full h-full"
          />
        </div>

        {/* Route Preview Panel */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Ready to Navigate
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {foundRoute.type === "transfer"
                ? `${foundRoute.segments.length} routes with transfer`
                : "Direct route"}
              {" - "}
              {foundRoute.totalStops} stops
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleBack} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleStartNavigation}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Start Navigation
            </Button>
          </div>

          {locationError && (
            <p className="text-sm text-red-500 text-center">{locationError}</p>
          )}
        </div>
      </div>
    );
  }

  // Active navigation state
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Status Bar */}
      <NavigationStatusBar />

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          routes={routes}
          stops={stops}
          selectedRoute={session?.selectedRoute || null}
          userLocation={userLocation}
          className="w-full h-full"
        />

        {/* Location error overlay */}
        {locationError && (
          <div className="absolute top-4 left-4 right-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm">
            {locationError}
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        {/* Milestones Timeline (collapsible on mobile) */}
        <div className="max-h-[200px] overflow-hidden">
          <MilestonesTimeline showIntermediates={false} maxHeight="200px" />
        </div>

        {/* Controls */}
        <NavigationControls />
      </div>
    </div>
  );
}

export default function NavigatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4rem)] dark:bg-gray-950">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              Preparing navigation...
            </p>
          </div>
        </div>
      }
    >
      <NavigateContent />
    </Suspense>
  );
}
