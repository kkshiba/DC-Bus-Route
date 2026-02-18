"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Map from "@/components/Map";
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

  // URL params
  const startParam = searchParams.get("start") || "";
  const destinationParam = searchParams.get("destination") || "";
  const routeParam = searchParams.get("route") || ""; // Single route to display

  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteResult | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locationFound, setLocationFound] = useState(false);

  // Async data loading state
  const [routes, setRoutes] = useState<GeoJSONRoute[]>([]);
  const [stops, setStops] = useState<GeoJSONStop[]>([]);
  const [routeData, setRouteData] = useState<ParsedRouteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Single route display state
  const [displayedRoute, setDisplayedRoute] = useState<GeoJSONRoute | null>(null);
  const [routeStops, setRouteStops] = useState<GeoJSONStop[]>([]);

  // Load route data from Supabase
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

  // Handle single route display (from ?route= param)
  useEffect(() => {
    if (routeParam && routes.length > 0) {
      const route = routes.find((r) => r.properties.routeId === routeParam);
      setDisplayedRoute(route || null);

      // Load ordered stops for this route
      if (route) {
        getOrderedStopsForRoute(routeParam).then((orderedStops) => {
          setRouteStops(orderedStops);
        });
      }
    } else {
      setDisplayedRoute(null);
      setRouteStops([]);
    }
  }, [routeParam, routes]);

  // Find route based on search params
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

  // Clear "found" flash after 3s
  useEffect(() => {
    if (locationFound) {
      const t = setTimeout(() => setLocationFound(false), 3000);
      return () => clearTimeout(t);
    }
  }, [locationFound]);

  // Get user location
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

  // Get directions text
  const directions = selectedRoute ? getRouteDirections(selectedRoute) : [];

  // Check if we have any route to display
  const hasRouteToDisplay = displayedRoute || selectedRoute;

  // Get route info for display
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

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-500">Loading route data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (loadError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
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
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
      {/* Map Area */}
      <div className="w-full md:w-[70%] h-[50vh] md:h-full relative">
        <Map
          routes={routes}
          stops={stops}
          selectedRoute={selectedRoute}
          highlightedRouteId={routeParam || undefined}
          userLocation={userLocation}
          className="w-full h-full"
        />

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
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Locating...</span>
              </>
            ) : locationFound ? (
              <>
                <LocateFixed className="w-5 h-5" />
                <span>Located</span>
              </>
            ) : (
              <>
                <LocateFixed className="w-5 h-5" />
                <span>My Location</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Side Panel */}
      <div className="w-full md:w-[30%] h-[50vh] md:h-full overflow-y-auto bg-gray-50">
        <div className="p-4 space-y-4">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="text-gray-600 hover:text-gray-900 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Button>

          {hasRouteToDisplay ? (
            <>
              {/* Route Header (for single route view) */}
              {routeInfo && (
                <Card className="overflow-hidden">
                  <div
                    className="h-2"
                    style={{ backgroundColor: routeInfo.color }}
                  />
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: routeInfo.color + "20" }}
                      >
                        <Bus
                          className="w-7 h-7"
                          style={{ color: routeInfo.color }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-gray-900">
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
                        <p className="text-gray-600 mt-0.5">{routeInfo.name}</p>
                        {routeInfo.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {routeInfo.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>{routeStops.length} stops</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Trip Summary (for search result) */}
              {selectedRoute && (
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
                            <p className="font-medium text-gray-900">
                              {transfer.properties.stopName}
                            </p>
                          </div>
                        </div>
                      ))}

                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">Get off at</p>
                          <p className="font-medium text-gray-900">
                            {
                              selectedRoute.segments[selectedRoute.segments.length - 1]
                                ?.alightingStop.properties.stopName
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Stops</p>
                        <p className="text-lg font-bold text-gray-900">
                          {selectedRoute.totalStops}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Distance</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatDistance(selectedRoute.totalDistanceKm)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatDuration(selectedRoute.estimatedDuration || 0)}
                        </p>
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
                            style={{
                              backgroundColor: segment.routeColor + "20",
                              color: segment.routeColor,
                            }}
                          >
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: segment.routeColor }}
                            />
                            {segment.routeName}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Directions */}
              {directions.length > 0 && (
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
              )}

              {/* Stops List */}
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
                          className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
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
                              <div
                                className="w-0.5 h-4 mt-1"
                                style={{ backgroundColor: routeInfo?.color || "#e5e7eb" }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm ${
                                index === 0 || index === routeStops.length - 1
                                  ? "font-semibold text-gray-900"
                                  : "text-gray-700"
                              }`}
                            >
                              {stop.properties.stopName}
                            </p>
                            {index === 0 && (
                              <p className="text-xs text-green-600 font-medium">
                                Start
                              </p>
                            )}
                            {index === routeStops.length - 1 && (
                              <p className="text-xs text-red-600 font-medium">End</p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  ) : selectedRoute ? (
                    <div className="space-y-1">
                      {selectedRoute.segments.flatMap((segment, segIndex) => {
                        const segmentStops = [
                          segment.boardingStop,
                          ...segment.intermediateStops,
                          segment.alightingStop,
                        ];
                        return segmentStops.map((stop, i) => {
                          const isBoarding = i === 0 && segIndex === 0;
                          const isAlighting =
                            i === segmentStops.length - 1 &&
                            segIndex === selectedRoute.segments.length - 1;
                          const isTransfer = selectedRoute.transferPoints.some(
                            (t) => t.properties.stopId === stop.properties.stopId
                          );

                          return (
                            <div
                              key={`${segIndex}-${stop.properties.stopId}`}
                              className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
                                isBoarding
                                  ? "bg-green-50"
                                  : isAlighting
                                  ? "bg-red-50"
                                  : isTransfer
                                  ? "bg-yellow-50"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <div
                                className={`w-2.5 h-2.5 rounded-full ${
                                  isBoarding
                                    ? "bg-green-500"
                                    : isAlighting
                                    ? "bg-red-500"
                                    : isTransfer
                                    ? "bg-yellow-500"
                                    : "bg-gray-300"
                                }`}
                              />
                              <span
                                className={`text-sm flex-1 ${
                                  isBoarding || isAlighting || isTransfer
                                    ? "font-medium"
                                    : ""
                                }`}
                              >
                                {stop.properties.stopName}
                              </span>
                              {isBoarding && (
                                <span className="text-xs text-green-600 font-medium">
                                  Board
                                </span>
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
            </>
          ) : (
            /* Empty State */
            <Card className="mt-4">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Bus className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Route Selected
                </h3>
                <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
                  Select a route from the homepage to view it on the map, or search
                  for a route between two locations.
                </p>
                <Link href="/">
                  <Button className="bg-primary-600 hover:bg-primary-700">
                    Browse Routes
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RouteMap() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
            <p className="mt-4 text-gray-500">Loading route map...</p>
          </div>
        </div>
      }
    >
      <RouteMapContent />
    </Suspense>
  );
}
