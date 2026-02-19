"use client";

import { useState, useEffect } from "react";
import { MapPin, Navigation, Search, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigationStore } from "@/stores/navigation-store";
import { loadRouteData, getRawGeoJSON } from "@/lib/data-loader";
import { findAllRoutes } from "@/lib/route-algorithm";
import { findNearestStop } from "@/lib/geo-utils";
import type { GeoJSONStop, ParsedRouteData } from "@/lib/types";

export function TripPlanner() {
  const {
    origin,
    destination,
    planningStatus,
    setOrigin,
    setDestination,
    setRouteOptions,
    setPlanningStatus,
  } = useNavigationStore();

  const [originInput, setOriginInput] = useState("");
  const [destinationInput, setDestinationInput] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<ParsedRouteData | null>(null);
  const [allStops, setAllStops] = useState<GeoJSONStop[]>([]);

  // Autocomplete state
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);

  // Load route data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [data, geojson] = await Promise.all([
          loadRouteData(),
          getRawGeoJSON(),
        ]);
        setRouteData(data);

        const stops = geojson.features.filter(
          (f) => f.geometry.type === "Point"
        ) as GeoJSONStop[];
        setAllStops(stops);
      } catch (error) {
        console.error("Failed to load route data:", error);
        setSearchError("Failed to load route data. Please refresh and try again.");
      }
    }
    loadData();
  }, []);

  // Get current location
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        // Find nearest stop to show a meaningful name
        if (allStops.length > 0) {
          const nearest = findNearestStop(coords, allStops);
          if (nearest) {
            setOrigin({
              ...coords,
              name: `Near ${nearest.stop.properties.stopName}`,
            });
            setOriginInput(`Near ${nearest.stop.properties.stopName}`);
          } else {
            setOrigin({ ...coords, name: "Current Location" });
            setOriginInput("Current Location");
          }
        } else {
          setOrigin({ ...coords, name: "Current Location" });
          setOriginInput("Current Location");
        }

        setIsGettingLocation(false);
      },
      (error) => {
        setIsGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Please allow location access to use this feature");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information is unavailable");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out");
            break;
          default:
            setLocationError("An unknown error occurred");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle stop selection (search for matching stop)
  const findStopByName = (name: string): GeoJSONStop | null => {
    const lowerName = name.toLowerCase().trim();
    if (!lowerName) return null;

    // Exact match first
    let stop = allStops.find(
      (s) => s.properties.stopName.toLowerCase() === lowerName
    );

    // Partial match
    if (!stop) {
      stop = allStops.find((s) =>
        s.properties.stopName.toLowerCase().includes(lowerName)
      );
    }

    return stop || null;
  };

  // Filter stops for autocomplete suggestions
  const getFilteredStops = (query: string): GeoJSONStop[] => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return allStops
      .filter((s) => s.properties.stopName.toLowerCase().includes(lower))
      .slice(0, 6);
  };

  // Get suggestions for inputs
  const originSuggestions = getFilteredStops(originInput);
  const destinationSuggestions = getFilteredStops(destinationInput);

  // Handle suggestion selection
  const selectOriginStop = (stop: GeoJSONStop) => {
    setOriginInput(stop.properties.stopName);
    setOrigin({
      lat: stop.geometry.coordinates[1],
      lng: stop.geometry.coordinates[0],
      name: stop.properties.stopName,
    });
    setShowOriginSuggestions(false);
  };

  const selectDestinationStop = (stop: GeoJSONStop) => {
    setDestinationInput(stop.properties.stopName);
    setDestination({
      lat: stop.geometry.coordinates[1],
      lng: stop.geometry.coordinates[0],
      name: stop.properties.stopName,
    });
    setShowDestinationSuggestions(false);
  };

  // Handle destination input change
  const handleDestinationChange = (value: string) => {
    setDestinationInput(value);

    const stop = findStopByName(value);
    if (stop) {
      setDestination({
        lat: stop.geometry.coordinates[1],
        lng: stop.geometry.coordinates[0],
        name: stop.properties.stopName,
      });
    }
  };

  // Handle origin input change (manual entry)
  const handleOriginChange = (value: string) => {
    setOriginInput(value);

    const stop = findStopByName(value);
    if (stop) {
      setOrigin({
        lat: stop.geometry.coordinates[1],
        lng: stop.geometry.coordinates[0],
        name: stop.properties.stopName,
      });
    }
  };

  // Find routes
  const handleFindRoutes = async () => {
    if (!origin || !destination || !routeData) {
      setSearchError("Please enter both origin and destination");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setPlanningStatus("planning");

    try {
      const routes = findAllRoutes(
        { origin, destination },
        routeData,
        3 // Get up to 3 routes
      );

      if (routes.length === 0) {
        setSearchError("No routes found between these locations. Try different stops.");
        setPlanningStatus("idle");
      } else {
        setRouteOptions(routes);
      }
    } catch (error) {
      console.error("Failed to find routes:", error);
      setSearchError("Failed to find routes. Please try again.");
      setPlanningStatus("idle");
    } finally {
      setIsSearching(false);
    }
  };

  const canSearch = origin && destination && routeData && !isSearching;

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Plan Your Trip
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Enter your starting point and destination
        </p>
      </div>

      {/* Origin Section */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Your Location
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500 z-10" />
          <input
            type="text"
            placeholder="Enter your location"
            value={originInput}
            onChange={(e) => {
              handleOriginChange(e.target.value);
              setShowOriginSuggestions(true);
            }}
            onFocus={() => originInput && setShowOriginSuggestions(true)}
            onBlur={() => setTimeout(() => setShowOriginSuggestions(false), 150)}
            className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {originInput && (
            <button
              onClick={() => {
                setOriginInput("");
                setOrigin(null as any);
                setShowOriginSuggestions(false);
              }}
              className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleGetLocation}
            disabled={isGettingLocation}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 z-10"
            title="Use current location"
          >
            {isGettingLocation ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Navigation className="w-5 h-5" />
            )}
          </button>

          {/* Origin Suggestions Dropdown */}
          {showOriginSuggestions && originSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg z-50 overflow-hidden">
              {originSuggestions.map((stop) => (
                <button
                  key={stop.properties.stopId}
                  onClick={() => selectOriginStop(stop)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {stop.properties.stopName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {locationError && (
          <p className="text-sm text-red-500">{locationError}</p>
        )}
      </div>

      {/* Destination Section */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Where to?
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500 z-10" />
          <input
            type="text"
            placeholder="Enter destination"
            value={destinationInput}
            onChange={(e) => {
              handleDestinationChange(e.target.value);
              setShowDestinationSuggestions(true);
            }}
            onFocus={() => destinationInput && setShowDestinationSuggestions(true)}
            onBlur={() => setTimeout(() => setShowDestinationSuggestions(false), 150)}
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {destinationInput && (
            <button
              onClick={() => {
                setDestinationInput("");
                setDestination(null as any);
                setShowDestinationSuggestions(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Destination Suggestions Dropdown */}
          {showDestinationSuggestions && destinationSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg z-50 overflow-hidden">
              {destinationSuggestions.map((stop) => (
                <button
                  key={stop.properties.stopId}
                  onClick={() => selectDestinationStop(stop)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {stop.properties.stopName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Suggested Stops */}
      {allStops.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Popular Stops
          </p>
          <div className="flex flex-wrap gap-2">
            {allStops.slice(0, 5).map((stop) => (
              <button
                key={stop.properties.stopId}
                onClick={() => {
                  setDestinationInput(stop.properties.stopName);
                  setDestination({
                    lat: stop.geometry.coordinates[1],
                    lng: stop.geometry.coordinates[0],
                    name: stop.properties.stopName,
                  });
                }}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {stop.properties.stopName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Error */}
      {searchError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{searchError}</p>
        </div>
      )}

      {/* Find Routes Button */}
      <Button
        onClick={handleFindRoutes}
        disabled={!canSearch}
        className="w-full h-14 text-lg font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSearching ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Finding Routes...
          </>
        ) : (
          <>
            <Search className="w-5 h-5 mr-2" />
            Find Routes
          </>
        )}
      </Button>
    </div>
  );
}
