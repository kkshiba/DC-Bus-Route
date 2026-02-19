"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Navigation, MessageSquare, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationInput } from "@/components/LocationInput";

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
      <section className="py-12 md:py-16 bg-gray-50 dark:bg-gray-800/50">
        <div className="container mx-auto px-4">
          <Card className="max-w-xl mx-auto shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-primary-700 dark:text-primary-400">
                Search Your Route
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="start"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
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
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
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

      {/* Features Section */}
      <section className="py-12 md:py-16 bg-gray-50 dark:bg-gray-800/50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-800 dark:text-gray-100">
            Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="text-center hover:shadow-lg transition-shadow"
              >
                <CardContent className="pt-6">
                  <div className="w-14 h-14 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                    <feature.icon className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-100">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
