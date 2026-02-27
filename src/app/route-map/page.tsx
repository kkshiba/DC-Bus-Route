"use client";

import { Suspense, useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Bus,
  LocateFixed,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Route,
  Circle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type SheetState = 'closed' | 'half' | 'full';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Map from "@/components/Map";
import { TabbedSidePanel } from "@/components/TabbedSidePanel";
import { RoutesSidePanel } from "@/components/RoutesSidePanel";
import { useNavigationStore } from "@/stores/navigation-store";
import { loadRouteData, getRawGeoJSON, getOrderedStopsForRoute } from "@/lib/data-loader";
import { findRoute, getRouteDirections } from "@/lib/route-algorithm";
import { formatDistance, formatDuration } from "@/lib/geo-utils";
import type {
  GeoJSONRoute,
  GeoJSONStop,
  RouteResult,
  Coordinates,
  ParsedRouteData,
} from "@/lib/types";

function RouteMapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const startParam = searchParams.get("start") || "";
  const destinationParam = searchParams.get("destination") || "";
  const routeParam = searchParams.get("route") || "";
  const tabParam = searchParams.get("tab") as "routes" | "navigate" | null;

  const { session, planningStatus } = useNavigationStore();

  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteResult | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locationFound, setLocationFound] = useState(false);

  const [routes, setRoutes] = useState<GeoJSONRoute[]>([]);
  const [stops, setStops] = useState<GeoJSONStop[]>([]);
  const [routeData, setRouteData] = useState<ParsedRouteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayedRoute, setDisplayedRoute] = useState<GeoJSONRoute | null>(null);
  const [routeStops, setRouteStops] = useState<GeoJSONStop[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
<<<<<<< HEAD

  // Mobile drawer state with snap points
  const [sheetState, setSheetState] = useState<SheetState>('closed');
=======
  const [mobileRoutesOpen, setMobileRoutesOpen] = useState(false);
>>>>>>> 61da6fecfc59f33198ccc5c37d405170e3ae7510

  // Animation states
  const [sidebarReady, setSidebarReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [detailsReady, setDetailsReady] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setLoadError(null);

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

  // Stagger entrance animations after data loads
  useEffect(() => {
    if (!isLoading) {
      // Sidebar first
      const t1 = setTimeout(() => setSidebarReady(true), 60);
      // Map slightly after
      const t2 = setTimeout(() => setMapReady(true), 180);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [isLoading]);

  // Animate details panel when it appears
  useEffect(() => {
    if (displayedRoute || selectedRoute) {
      setDetailsReady(false);
      const t = setTimeout(() => setDetailsReady(true), 40);
      return () => clearTimeout(t);
    } else {
      setDetailsReady(false);
    }
  }, [displayedRoute, selectedRoute]);

  useEffect(() => {
    if (routeParam && routes.length > 0) {
      const route = routes.find((r) => r.properties.routeId === routeParam);
      setDisplayedRoute(route || null);

      if (route) {
        getOrderedStopsForRoute(routeParam).then((orderedStops) => {
          setRouteStops(orderedStops);
        });
      }

      setSelectedRouteIds((prev) =>
        prev.includes(routeParam) ? prev : [routeParam]
      );
    } else {
      setDisplayedRoute(null);
      setRouteStops([]);
    }
  }, [routeParam, routes]);

  useEffect(() => {
    if (startParam && destinationParam && routeData && stops.length > 0) {
      const startStop = stops.find((s) =>
        s.properties.stopName.toLowerCase().includes(startParam.toLowerCase())
      );
      const destStop = stops.find((s) =>
        s.properties.stopName.toLowerCase().includes(destinationParam.toLowerCase())
      );

      if (startStop && destStop) {
        const result = findRoute(
          {
            origin: {
              lat: startStop.geometry.coordinates[1],
              lng: startStop.geometry.coordinates[0],
            },
            destination: {
              lat: destStop.geometry.coordinates[1],
              lng: destStop.geometry.coordinates[0],
            },
          },
          routeData
        );
        setSelectedRoute(result);
      }
    }
  }, [startParam, destinationParam, stops, routeData]);

  useEffect(() => {
    if (locationFound) {
      const t = setTimeout(() => setLocationFound(false), 3000);
      return () => clearTimeout(t);
    }
  }, [locationFound]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocateError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setLocateError(null);
    setLocationFound(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
        setLocationFound(true);
      },
      (error) => {
        console.error("Error getting location:", error);
        setLocateError("Unable to get your location. Please enable location services.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const directions = selectedRoute ? getRouteDirections(selectedRoute) : [];
  const hasRouteToDisplay = displayedRoute || selectedRoute;

  const routeInfo = useMemo(() => {
    if (displayedRoute) {
      const routeId = displayedRoute.properties.routeId;
      const parts = routeId.split("-");
      return {
        routeNumber: parts[0],
        timePeriod: parts[1] || "",
        name: displayedRoute.properties.routeName,
        color: displayedRoute.properties.color,
        description: displayedRoute.properties.description,
      };
    }
    return null;
  }, [displayedRoute]);

<<<<<<< HEAD
  // Bottom sheet multi-state gesture handling
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetTranslateY, setSheetTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);

  // Sheet height constants (in vh)
  const SHEET_HALF_HEIGHT = 45;
  const SHEET_FULL_HEIGHT = 80;

  // Get current height based on state
  const getSheetHeight = useCallback((state: SheetState) => {
    switch (state) {
      case 'half': return SHEET_HALF_HEIGHT;
      case 'full': return SHEET_FULL_HEIGHT;
      default: return 0;
    }
  }, []);

  // Transition to a new sheet state with animation
  const transitionTo = useCallback((newState: SheetState) => {
    if (newState === 'closed') {
      setIsAnimating(true);
      setTimeout(() => {
        setSheetState('closed');
        setIsAnimating(false);
      }, 250);
    } else {
      setSheetState(newState);
    }
    setSheetTranslateY(0);
  }, []);

  // Toggle between half and full states
  const toggleSheetSize = useCallback(() => {
    if (sheetState === 'half') {
      setSheetState('full');
    } else if (sheetState === 'full') {
      setSheetState('half');
    }
  }, [sheetState]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    touchCurrentY.current = e.touches[0].clientY;
    const deltaY = touchCurrentY.current - touchStartY.current;
    setSheetTranslateY(deltaY);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const deltaY = sheetTranslateY;
    const threshold = 80; // px threshold for state change

    if (sheetState === 'full') {
      if (deltaY > threshold) {
        // Swipe down from full → half
        transitionTo('half');
      } else if (deltaY < -threshold) {
        // Already at full, do nothing (or could add overscroll effect)
        setSheetTranslateY(0);
      } else {
        setSheetTranslateY(0);
      }
    } else if (sheetState === 'half') {
      if (deltaY > threshold) {
        // Swipe down from half → close
        transitionTo('closed');
      } else if (deltaY < -threshold) {
        // Swipe up from half → full
        transitionTo('full');
      } else {
        setSheetTranslateY(0);
      }
    }
  }, [sheetTranslateY, sheetState, transitionTo]);

  // Reset sheet position when state changes
  useEffect(() => {
    if (sheetState !== 'closed') {
      setSheetTranslateY(0);
      setIsAnimating(false);
    }
  }, [sheetState]);

  // Show loading state
=======
>>>>>>> 61da6fecfc59f33198ccc5c37d405170e3ae7510
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-4rem)] bg-white dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading route data...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-4rem)] bg-white dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-500">{loadError}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fade-scale-in {
          from { opacity: 0; transform: scale(0.985); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slide-up-fade {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sidebar-enter {
          animation: slide-in-left 0.45s cubic-bezier(0.22,1,0.36,1) both;
        }
        .map-enter {
          animation: fade-scale-in 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        .details-enter {
          animation: slide-in-right 0.4s cubic-bezier(0.22,1,0.36,1) both;
        }
        .stagger-item {
          opacity: 0;
          animation: slide-up-fade 0.4s cubic-bezier(0.22,1,0.36,1) forwards;
        }
      `}</style>

      <div className="flex h-[calc(100dvh-4rem)] overflow-hidden">

<<<<<<< HEAD
        {/* Mobile Routes FAB - hidden when sheet is open */}
        {sheetState === 'closed' && (
          <button
            onClick={() => setSheetState('half')}
            className="md:hidden absolute bottom-6 left-4 flex items-center gap-2 px-4 py-3 rounded-full shadow-xl bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 font-semibold text-sm z-[1000] fab-button animate-pulse-subtle"
          >
            <Bus className="w-5 h-5" />
            <span>Routes</span>
            {selectedRouteIds.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-600 text-white text-xs font-bold">
                {selectedRouteIds.length}
              </span>
            )}
          </button>
        )}
=======
        {/* Sidebar — slides in from left */}
        <div className={`hidden md:block ${sidebarReady ? "sidebar-enter" : "opacity-0"}`}>
          <TabbedSidePanel
            selectedRouteIds={selectedRouteIds}
            onSelectionChange={setSelectedRouteIds}
            defaultTab={tabParam === "navigate" ? "navigate" : "routes"}
          />
        </div>
>>>>>>> 61da6fecfc59f33198ccc5c37d405170e3ae7510

        {/* Map — fades + scales in */}
        <div className={`flex-1 h-full relative ${mapReady ? "map-enter" : "opacity-0"}`}>
          <Map
            routes={routes}
            stops={stops}
            selectedRoute={session?.selectedRoute || selectedRoute}
            highlightedRouteId={routeParam || undefined}
            highlightedRouteIds={
              planningStatus === "navigating" && session
                ? session.selectedRoute.segments.map((s) => s.routeId)
                : selectedRouteIds
            }
            userLocation={userLocation}
            className="w-full h-full"
          />

          {/* Mobile Routes FAB */}
          <button
<<<<<<< HEAD
            onClick={handleLocateMe}
            disabled={isLocating}
            title="Show my location on map"
            className={`
              flex items-center gap-2 px-4 py-3 rounded-full shadow-xl
              font-semibold text-sm fab-button
              focus:outline-none focus:ring-4 focus:ring-blue-300
              ${
                isLocating
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : locationFound
                  ? "bg-green-500 text-white"
                  : "bg-white text-primary-600 border border-gray-200"
              }
            `}
=======
            onClick={() => setMobileRoutesOpen(true)}
            className="md:hidden absolute bottom-6 left-4 flex items-center gap-2 px-4 py-3 rounded-full shadow-xl bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-gray-700 active:scale-95 border border-gray-200 dark:border-gray-700 font-semibold text-sm transition-all duration-200 z-[1000]"
>>>>>>> 61da6fecfc59f33198ccc5c37d405170e3ae7510
          >
            <Bus className="w-5 h-5" />
            <span>Routes</span>
            {selectedRouteIds.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-600 text-white text-xs font-bold">
                {selectedRouteIds.length}
              </span>
            )}
          </button>

          {/* Locate Me FAB */}
          <div className="absolute bottom-6 right-4 flex flex-col items-end gap-2 z-[1000]">
            {locateError && (
              <div className="bg-red-600 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-[200px] text-right">
                {locateError}
              </div>
            )}
            {locationFound && (
              <div className="bg-green-600 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                Location found!
              </div>
            )}
            <button
              onClick={handleLocateMe}
              disabled={isLocating}
              title="Show my location on map"
              className={`
                flex items-center gap-2 px-4 py-3 rounded-full shadow-xl
                font-semibold text-sm transition-all duration-200
                focus:outline-none focus:ring-4 focus:ring-blue-300
                ${
                  isLocating
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : locationFound
                    ? "bg-green-500 text-white hover:bg-green-600 active:scale-95"
                    : "bg-white text-primary-600 hover:bg-primary-50 active:scale-95 border border-gray-200"
                }
              `}
            >
              {isLocating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>Locating...</span></>
              ) : locationFound ? (
                <><LocateFixed className="w-5 h-5" /><span>Located</span></>
              ) : (
                <><LocateFixed className="w-5 h-5" /><span>My Location</span></>
              )}
            </button>
          </div>
        </div>

        {/* Route Details Panel — slides in from right */}
        {hasRouteToDisplay && (
          <div className={`hidden md:block w-80 h-full overflow-y-auto bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 ${detailsReady ? "details-enter" : "opacity-0"}`}>
            <div className="p-4 space-y-4">

              <div className="stagger-item" style={{ animationDelay: "0.05s" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedRouteIds([]);
                    router.push("/route-map");
                  }}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 -ml-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Clear Selection
                </Button>
              </div>

              {routeInfo && (
                <div className="stagger-item" style={{ animationDelay: "0.12s" }}>
                  <Card className="overflow-hidden">
                    <div className="h-2" style={{ backgroundColor: routeInfo.color }} />
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: routeInfo.color + "20" }}
                        >
                          <Bus className="w-7 h-7" style={{ color: routeInfo.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                              {routeInfo.routeNumber}
                            </h2>
                            {routeInfo.timePeriod && (
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{
                                  backgroundColor: routeInfo.color + "20",
                                  color: routeInfo.color,
                                }}
                              >
                                {routeInfo.timePeriod}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 dark:text-gray-300 mt-0.5">{routeInfo.name}</p>
                          {routeInfo.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {routeInfo.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <MapPin className="w-4 h-4" />
                          <span>{routeStops.length} stops</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedRoute && (
                <div className="stagger-item" style={{ animationDelay: "0.18s" }}>
                  <Card>
                    <CardContent className="pt-4">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <Route className="w-5 h-5 text-primary-600" />
                        Trip Summary
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500">Board at</p>
                            <p className="font-medium text-gray-900">
                              {selectedRoute.segments[0]?.boardingStop.properties.stopName}
                            </p>
                          </div>
                        </div>
                        {selectedRoute.transferPoints.map((transfer, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="w-3 h-3 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500">Transfer at</p>
                              <p className="font-medium text-gray-900">{transfer.properties.stopName}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500">Get off at</p>
                            <p className="font-medium text-gray-900">
                              {selectedRoute.segments[selectedRoute.segments.length - 1]?.alightingStop.properties.stopName}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">Stops</p>
                          <p className="text-lg font-bold text-gray-900">{selectedRoute.totalStops}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">Distance</p>
                          <p className="text-lg font-bold text-gray-900">{formatDistance(selectedRoute.totalDistanceKm)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">Duration</p>
                          <p className="text-lg font-bold text-gray-900">{formatDuration(selectedRoute.estimatedDuration || 0)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500">Type</p>
                          <p className="text-lg font-bold text-gray-900 capitalize">
                            {selectedRoute.type === "transfer" ? "Transfer" : "Direct"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-gray-500 mb-2">Routes</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedRoute.segments.map((segment, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                              style={{ backgroundColor: segment.routeColor + "20", color: segment.routeColor }}
                            >
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: segment.routeColor }} />
                              {segment.routeName}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {directions.length > 0 && (
                <div className="stagger-item" style={{ animationDelay: "0.24s" }}>
                  <Card>
                    <CardContent className="pt-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Directions</h3>
                      <ol className="space-y-2">
                        {directions.map((direction, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-semibold">
                              {i + 1}
                            </span>
                            <span className="text-gray-700 pt-0.5">{direction}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="stagger-item" style={{ animationDelay: "0.30s" }}>
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-primary-600" />
                      Bus Stops
                    </h3>
                    {routeStops.length > 0 ? (
                      <div className="space-y-1">
                        {routeStops.map((stop, index) => (
                          <div
                            key={stop.properties.stopId}
                            className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors stagger-item"
                            style={{ animationDelay: `${0.32 + index * 0.03}s` }}
                          >
                            <div className="flex flex-col items-center">
                              <Circle
                                className="w-3 h-3"
                                style={{
                                  color: routeInfo?.color || "#6b7280",
                                  fill: index === 0 || index === routeStops.length - 1
                                    ? routeInfo?.color || "#6b7280"
                                    : "transparent",
                                }}
                              />
                              {index < routeStops.length - 1 && (
                                <div className="w-0.5 h-4 mt-1" style={{ backgroundColor: routeInfo?.color || "#e5e7eb" }} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${index === 0 || index === routeStops.length - 1 ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                                {stop.properties.stopName}
                              </p>
                              {index === 0 && <p className="text-xs text-green-600 font-medium">Start</p>}
                              {index === routeStops.length - 1 && <p className="text-xs text-red-600 font-medium">End</p>}
                            </div>
                            <span className="text-xs text-gray-400">{index + 1}</span>
                          </div>
                        ))}
                      </div>
                    ) : selectedRoute ? (
                      <div className="space-y-1">
                        {selectedRoute.segments.flatMap((segment, segIndex) => {
                          const segmentStops = [segment.boardingStop, ...segment.intermediateStops, segment.alightingStop];
                          return segmentStops.map((stop, i) => {
                            const isBoarding = i === 0 && segIndex === 0;
                            const isAlighting = i === segmentStops.length - 1 && segIndex === selectedRoute.segments.length - 1;
                            const isTransfer = selectedRoute.transferPoints.some((t) => t.properties.stopId === stop.properties.stopId);
                            return (
                              <div
                                key={`${segIndex}-${stop.properties.stopId}`}
                                className={`flex items-center gap-3 py-2 px-3 rounded-lg stagger-item ${isBoarding ? "bg-green-50" : isAlighting ? "bg-red-50" : isTransfer ? "bg-yellow-50" : "hover:bg-gray-50"}`}
                                style={{ animationDelay: `${0.32 + i * 0.03}s` }}
                              >
                                <div className={`w-2.5 h-2.5 rounded-full ${isBoarding ? "bg-green-500" : isAlighting ? "bg-red-500" : isTransfer ? "bg-yellow-500" : "bg-gray-300"}`} />
                                <span className={`text-sm flex-1 ${isBoarding || isAlighting || isTransfer ? "font-medium" : ""}`}>
                                  {stop.properties.stopName}
                                </span>
<<<<<<< HEAD
                              )}
                              {isAlighting && (
                                <span className="text-xs text-red-600 font-medium">
                                  Alight
                                </span>
                              )}
                              {isTransfer && !isBoarding && !isAlighting && (
                                <span className="text-xs text-yellow-600 font-medium">
                                  Transfer
                                </span>
                              )}
                            </div>
                          );
                        });
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No stops to display
                    </p>
                  )}
                </CardContent>
              </Card>
        </div>
      </div>
      )}

      {/* Mobile Routes Bottom Sheet */}
      {/* Mobile Routes Bottom Sheet - Multi-state */}
      {(sheetState !== 'closed' || isAnimating) && (
        <div className="md:hidden fixed inset-0 z-[2000] pointer-events-none">
          {/* Backdrop - only visible in full mode */}
          <div
            className={`absolute inset-0 bg-black pointer-events-auto transition-opacity duration-200 ${
              isAnimating ? 'opacity-0' : sheetState === 'full' ? 'opacity-50' : 'opacity-0'
            }`}
            style={{
              opacity: isDragging && sheetState === 'full'
                ? Math.max(0, 0.5 - Math.max(0, sheetTranslateY) / 400)
                : undefined
            }}
            onClick={() => transitionTo('half')}
          />

          {/* Bottom Sheet */}
          <div
            ref={sheetRef}
            className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl flex flex-col pointer-events-auto ${
              isAnimating ? 'animate-slide-down-smooth' : 'animate-slide-up-smooth'
            }`}
            style={{
              height: `${getSheetHeight(sheetState)}vh`,
              transform: isDragging ? `translateY(${Math.max(-50, sheetTranslateY)}px)` : undefined,
              transition: isDragging ? 'none' : 'height 0.25s ease-out, transform 0.25s ease-out',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Handle - tap to toggle size */}
            <div
              className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
              onClick={toggleSheetSize}
            >
              <div className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <Bus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                    Bus Routes
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedRouteIds.length > 0
                      ? `${selectedRouteIds.length} selected`
                      : sheetState === 'half' ? "Swipe up to expand" : "Swipe down to minimize"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Expand/Collapse button */}
                <button
                  onClick={toggleSheetSize}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center transition-transform active:scale-90"
                  title={sheetState === 'half' ? 'Expand' : 'Minimize'}
                >
                  {sheetState === 'half' ? (
                    <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  )}
                </button>
                {/* Close button */}
                <button
                  onClick={() => transitionTo('closed')}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center transition-transform active:scale-90"
                >
                  <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>

            {/* Routes Panel Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <RoutesSidePanel
                selectedRouteIds={selectedRouteIds}
                onSelectionChange={setSelectedRouteIds}
                compact
              />
=======
                                {isBoarding && <span className="text-xs text-green-600 font-medium">Board</span>}
                                {isAlighting && <span className="text-xs text-red-600 font-medium">Alight</span>}
                                {isTransfer && !isBoarding && !isAlighting && <span className="text-xs text-yellow-600 font-medium">Transfer</span>}
                              </div>
                            );
                          });
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">No stops to display</p>
                    )}
                  </CardContent>
                </Card>
              </div>

>>>>>>> 61da6fecfc59f33198ccc5c37d405170e3ae7510
            </div>
          </div>
        )}

        {/* Mobile Routes Bottom Sheet */}
        {mobileRoutesOpen && (
          <div className="md:hidden fixed inset-0 z-[2000]">
            <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={() => setMobileRoutesOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>
              <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Bus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">Bus Routes</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedRouteIds.length > 0 ? `${selectedRouteIds.length} selected` : "Select routes to view on map"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileRoutesOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <RoutesSidePanel
                  selectedRouteIds={selectedRouteIds}
                  onSelectionChange={setSelectedRouteIds}
                  compact
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function RouteMap() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100dvh-4rem)] bg-white dark:bg-gray-900">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading route map...</p>
          </div>
        </div>
      }
    >
      <RouteMapContent />
    </Suspense>
  );
}