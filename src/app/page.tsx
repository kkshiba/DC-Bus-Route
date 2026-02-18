"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Navigation, MessageSquare, Map, Clock, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationInput } from "@/components/LocationInput";
import { loadRoutesList, type RouteInfo } from "@/lib/data-loader";

const features = [
  {
    icon: Map,
    title: "Interactive Map",
    description: "View bus routes on an interactive map powered by OpenStreetMap",
  },
  {
    icon: MapPin,
    title: "Marked Bus Stops",
    description: "See all bus stops clearly marked with names and route info",
  },
  {
    icon: Navigation,
    title: "Boarding & Drop-off Search",
    description: "Find where to board and where to get off for your destination",
  },
  {
    icon: MessageSquare,
    title: "AI Route Suggestions",
    description: "Get smart route recommendations including transfer options",
  },
];

export default function Home() {
  const router = useRouter();
  const [startLocation, setStartLocation] = useState("");
  const [startCoords, setStartCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState("");
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);

  // Load routes on mount
  useEffect(() => {
    loadRoutesList().then((data) => {
      setRoutes(data);
      setIsLoadingRoutes(false);
    });
  }, []);

  const handleStartChange = (value: string, coords?: { lat: number; lng: number }) => {
    setStartLocation(value);
    setStartCoords(coords || null);
  };

  const handleDestChange = (value: string, coords?: { lat: number; lng: number }) => {
    setDestination(value);
    setDestCoords(coords || null);
  };

  const handleFindRoute = () => {
    const params = new URLSearchParams();
    if (startLocation) params.set("start", startLocation);
    if (destination) params.set("destination", destination);
    if (startCoords) {
      params.set("startLat", startCoords.lat.toString());
      params.set("startLng", startCoords.lng.toString());
    }
    if (destCoords) {
      params.set("destLat", destCoords.lat.toString());
      params.set("destLng", destCoords.lng.toString());
    }
    router.push(`/route-map?${params.toString()}`);
  };

  const handleRouteClick = (routeId: string) => {
    router.push(`/route-map?route=${routeId}`);
  };

  // Group routes by route number
  const groupedRoutes = routes.reduce((acc, route) => {
    if (!acc[route.routeNumber]) {
      acc[route.routeNumber] = [];
    }
    acc[route.routeNumber].push(route);
    return acc;
  }, {} as Record<string, RouteInfo[]>);

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            Navigate Davao City with Ease
          </h1>
          <h2 className="text-xl md:text-2xl font-medium mb-6 text-primary-100">
            Find your route. Know your stops. Never get lost again.
          </h2>
          <p className="text-sm md:text-base text-primary-200">
            Designed for daily commuters and first-time riders.
          </p>
        </div>
      </section>

      {/* Route Selection Form */}
      <section className="py-12 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <Card className="max-w-xl mx-auto shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-primary-700">
                Search Your Route
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="start"
                  className="text-sm font-medium text-gray-700"
                >
                  Start Location
                </label>
                <LocationInput
                  id="start"
                  value={startLocation}
                  onChange={handleStartChange}
                  placeholder="Search bus stop or address..."
                  iconColor="green"
                  showLocateButton={true}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="destination"
                  className="text-sm font-medium text-gray-700"
                >
                  Destination
                </label>
                <LocationInput
                  id="destination"
                  value={destination}
                  onChange={handleDestChange}
                  placeholder="Search bus stop or address..."
                  iconColor="red"
                />
              </div>

              <Button
                onClick={handleFindRoute}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-6 text-lg"
              >
                Find Route
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Browse All Routes Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-800">
            Browse All Routes
          </h2>
          <p className="text-center text-gray-600 mb-8">
            Click on a route to view it on the map
          </p>

          {isLoadingRoutes ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
              <p className="mt-2 text-gray-500">Loading routes...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(groupedRoutes).map(([routeNumber, routeGroup]) => (
                <Card
                  key={routeNumber}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div
                    className="h-2"
                    style={{ backgroundColor: routeGroup[0].color }}
                  />
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: routeGroup[0].color + "20" }}
                      >
                        <Bus
                          className="w-6 h-6"
                          style={{ color: routeGroup[0].color }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-gray-800">
                          {routeNumber}
                        </h3>
                        <p className="text-sm text-gray-600 truncate">
                          {routeGroup[0].name}
                        </p>
                        {routeGroup[0].area && (
                          <p className="text-xs text-gray-500 mt-1">
                            {routeGroup[0].area}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* AM/PM buttons */}
                    <div className="flex gap-2 mt-4">
                      {routeGroup.map((route) => (
                        <button
                          key={route.routeId}
                          onClick={() => handleRouteClick(route.routeId)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                          style={{
                            backgroundColor: route.color + "15",
                            color: route.color,
                          }}
                        >
                          <Clock className="w-4 h-4" />
                          {route.timePeriod}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-800">
            Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="text-center hover:shadow-lg transition-shadow"
              >
                <CardContent className="pt-6">
                  <div className="w-14 h-14 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                    <feature.icon className="w-7 h-7 text-primary-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-800">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
