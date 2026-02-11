"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, Navigation, Clock, Bus, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Map from "@/components/Map";
import { loadRouteData, getRawGeoJSON } from "@/lib/data-loader";
import { findRoute, getRouteDirections } from "@/lib/route-algorithm";
import { formatDistance, formatDuration, findNearestStop } from "@/lib/geo-utils";
import type { GeoJSONRoute, GeoJSONStop, RouteResult, Coordinates } from "@/lib/types";

function RouteMapContent() {
  const searchParams = useSearchParams();
  const startParam = searchParams.get("start") || "";
  const destinationParam = searchParams.get("destination") || "";

  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteResult | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Load route data
  const { routes, stops, routeData } = useMemo(() => {
    const geojson = getRawGeoJSON();
    const routeData = loadRouteData();

    const routes: GeoJSONRoute[] = [];
    const stops: GeoJSONStop[] = [];

    for (const feature of geojson.features) {
      if (feature.geometry.type === "LineString") {
        routes.push(feature as GeoJSONRoute);
      } else if (feature.geometry.type === "Point") {
        stops.push(feature as GeoJSONStop);
      }
    }

    return { routes, stops, routeData };
  }, []);

  // Find route based on search params or user location
  useEffect(() => {
    if (startParam && destinationParam) {
      // Find stops matching the search params
      const startStop = stops.find(
        (s) => s.properties.stopName.toLowerCase().includes(startParam.toLowerCase())
      );
      const destStop = stops.find(
        (s) => s.properties.stopName.toLowerCase().includes(destinationParam.toLowerCase())
      );

      if (startStop && destStop) {
        const result = findRoute(
          {
            origin: { lat: startStop.geometry.coordinates[1], lng: startStop.geometry.coordinates[0] },
            destination: { lat: destStop.geometry.coordinates[1], lng: destStop.geometry.coordinates[0] },
          },
          routeData
        );
        setSelectedRoute(result);
      }
    }
  }, [startParam, destinationParam, stops, routeData]);

  // Get user location
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert("Unable to get your location. Please enable location services.");
        setIsLocating(false);
      }
    );
  };

  // Get directions text
  const directions = selectedRoute ? getRouteDirections(selectedRoute) : [];

  // Get all stops in order for the selected route
  const routeStopsList = useMemo(() => {
    if (!selectedRoute) return [];

    const allStops: GeoJSONStop[] = [];
    for (const segment of selectedRoute.segments) {
      allStops.push(segment.boardingStop);
      allStops.push(...segment.intermediateStops);
      allStops.push(segment.alightingStop);
    }

    // Remove duplicates (transfer points appear twice)
    return allStops.filter(
      (stop, index, self) =>
        index === self.findIndex((s) => s.properties.stopId === stop.properties.stopId)
    );
  }, [selectedRoute]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
      {/* Map Area - 70% on desktop, full width on mobile */}
      <div className="w-full md:w-[70%] h-[50vh] md:h-full relative">
        <Map
          routes={routes}
          stops={stops}
          selectedRoute={selectedRoute}
          userLocation={userLocation}
          className="w-full h-full"
        />

        {/* Locate Me Button */}
        <Button
          onClick={handleLocateMe}
          disabled={isLocating}
          className="absolute bottom-4 right-4 bg-white text-primary-600 hover:bg-gray-100 shadow-lg"
          size="sm"
        >
          <Navigation className="w-4 h-4 mr-2" />
          {isLocating ? "Locating..." : "Locate Me"}
        </Button>
      </div>

      {/* Side Panel - 30% on desktop, full width on mobile */}
      <div className="w-full md:w-[30%] h-[50vh] md:h-full overflow-y-auto bg-white border-l border-gray-200">
        <div className="p-4 space-y-4">
          {/* Trip Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bus className="w-5 h-5 text-primary-600" />
                Trip Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedRoute ? (
                <>
                  {/* Boarding Point */}
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
                    <div>
                      <p className="text-xs text-gray-500">Boarding Point</p>
                      <p className="font-medium">
                        {selectedRoute.segments[0]?.boardingStop.properties.stopName}
                      </p>
                    </div>
                  </div>

                  {/* Transfer Points */}
                  {selectedRoute.transferPoints.map((transfer, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-yellow-500 mt-1.5" />
                      <div>
                        <p className="text-xs text-gray-500">Transfer Point</p>
                        <p className="font-medium">{transfer.properties.stopName}</p>
                      </div>
                    </div>
                  ))}

                  {/* Drop-off Point */}
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
                    <div>
                      <p className="text-xs text-gray-500">Drop-off Point</p>
                      <p className="font-medium">
                        {selectedRoute.segments[selectedRoute.segments.length - 1]?.alightingStop.properties.stopName}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="pt-3 border-t grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Total Stops</p>
                      <p className="font-semibold text-lg">{selectedRoute.totalStops}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Distance</p>
                      <p className="font-semibold text-lg">
                        {formatDistance(selectedRoute.totalDistanceKm)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Est. Duration</p>
                      <p className="font-semibold text-lg flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(selectedRoute.estimatedDuration || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Route Type</p>
                      <p className="font-semibold text-lg capitalize">
                        {selectedRoute.type === "transfer" ? "With Transfer" : "Direct"}
                      </p>
                    </div>
                  </div>

                  {/* Route Names */}
                  <div className="pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-2">Route(s)</p>
                    {selectedRoute.segments.map((segment, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm"
                        style={{ color: segment.routeColor }}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: segment.routeColor }}
                        />
                        <span className="font-medium">{segment.routeName}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <p>No route selected</p>
                  <p className="text-sm mt-1">
                    {startParam || destinationParam
                      ? "Could not find a route for your search"
                      : "Search for a route from the home page"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Directions */}
          {directions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Directions</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {directions.map((direction, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">
                        {i + 1}
                      </span>
                      <span>{direction}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Bus Stops List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-600" />
                Bus Stops
              </CardTitle>
            </CardHeader>
            <CardContent>
              {routeStopsList.length > 0 ? (
                <ol className="space-y-1">
                  {routeStopsList.map((stop, index) => {
                    const isBoarding =
                      selectedRoute?.segments[0]?.boardingStop.properties.stopId ===
                      stop.properties.stopId;
                    const isAlighting =
                      selectedRoute?.segments[selectedRoute.segments.length - 1]
                        ?.alightingStop.properties.stopId === stop.properties.stopId;
                    const isTransfer = selectedRoute?.transferPoints.some(
                      (t) => t.properties.stopId === stop.properties.stopId
                    );

                    return (
                      <li
                        key={stop.properties.stopId}
                        className={`flex items-center gap-2 py-2 px-2 rounded ${
                          isBoarding
                            ? "bg-green-50 border-l-4 border-green-500"
                            : isAlighting
                            ? "bg-red-50 border-l-4 border-red-500"
                            : isTransfer
                            ? "bg-yellow-50 border-l-4 border-yellow-500"
                            : "border-l-4 border-gray-200"
                        }`}
                      >
                        <span className="text-xs text-gray-400 w-4">{index + 1}</span>
                        <span
                          className={`text-sm ${
                            isBoarding || isAlighting || isTransfer
                              ? "font-medium"
                              : ""
                          }`}
                        >
                          {stop.properties.stopName}
                        </span>
                        {isBoarding && (
                          <span className="ml-auto text-xs text-green-600 font-medium">
                            Board here
                          </span>
                        )}
                        {isAlighting && (
                          <span className="ml-auto text-xs text-red-600 font-medium">
                            Get off here
                          </span>
                        )}
                        {isTransfer && !isBoarding && !isAlighting && (
                          <span className="ml-auto text-xs text-yellow-600 font-medium">
                            Transfer
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <p>No stops to display</p>
                  <p className="mt-1">Select a route to see the stops</p>
                </div>
              )}
            </CardContent>
          </Card>
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading route map...</p>
          </div>
        </div>
      }
    >
      <RouteMapContent />
    </Suspense>
  );
}
