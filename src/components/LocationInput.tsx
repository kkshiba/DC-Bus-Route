"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Bus, Loader2, Crosshair } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

interface LocationSuggestion {
  id: string;
  name: string;
  type: "stop" | "address";
  lat: number;
  lng: number;
  routeIds?: string[];
}

interface LocationInputProps {
  id: string;
  value: string;
  onChange: (value: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  iconColor?: "green" | "red";
  showLocateButton?: boolean;
}

export function LocationInput({
  id,
  value,
  onChange,
  placeholder = "Enter location",
  iconColor = "green",
  showLocateButton = false,
}: LocationInputProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search for stops in database
  const searchStops = async (query: string): Promise<LocationSuggestion[]> => {
    if (query.length < 2) return [];

    const { data, error } = await supabase
      .from("stops_with_routes")
      .select("stop_id, stop_name, lat, lng, route_ids")
      .ilike("stop_name", `%${query}%`)
      .limit(5);

    if (error || !data) return [];

    return data.map((stop) => ({
      id: stop.stop_id,
      name: stop.stop_name,
      type: "stop" as const,
      lat: stop.lat,
      lng: stop.lng,
      routeIds: stop.route_ids || [],
    }));
  };

  // Search for addresses using Nominatim
  const searchAddresses = async (query: string): Promise<LocationSuggestion[]> => {
    if (query.length < 3) return [];

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query + ", Davao City, Philippines"
        )}&limit=3&addressdetails=1`,
        {
          headers: {
            "User-Agent": "DCBusRoute/1.0",
          },
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.map((item: { place_id: number; display_name: string; lat: string; lon: string }) => ({
        id: `addr-${item.place_id}`,
        name: item.display_name.split(",").slice(0, 3).join(","),
        type: "address" as const,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));
    } catch {
      return [];
    }
  };

  // Combined search with debounce
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);

    const [stops, addresses] = await Promise.all([
      searchStops(query),
      searchAddresses(query),
    ]);

    setSuggestions([...stops, ...addresses]);
    setIsLoading(false);
    setHighlightedIndex(-1);
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      handleSearch(newValue);
    }, 300);
  };

  // Handle suggestion selection
  const handleSelect = (suggestion: LocationSuggestion) => {
    onChange(suggestion.name, { lat: suggestion.lat, lng: suggestion.lng });
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  // Handle geolocation
  const handleLocateMe = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                "User-Agent": "DCBusRoute/1.0",
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const address = data.display_name.split(",").slice(0, 3).join(",");
            onChange(address, { lat: latitude, lng: longitude });
          } else {
            onChange(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, {
              lat: latitude,
              lng: longitude,
            });
          }
        } catch {
          onChange(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, {
            lat: latitude,
            lng: longitude,
          });
        }

        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert("Location permission denied. Please enable location access.");
            break;
          case error.POSITION_UNAVAILABLE:
            alert("Location information unavailable.");
            break;
          case error.TIMEOUT:
            alert("Location request timed out.");
            break;
          default:
            alert("An error occurred while getting your location.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const iconColorClass = iconColor === "green" ? "text-green-500" : "text-red-500";

  return (
    <div className="relative">
      <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${iconColorClass}`} />
      <Input
        ref={inputRef}
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => value.length >= 2 && suggestions.length > 0 && setIsOpen(true)}
        className={`pl-10 ${showLocateButton ? "pr-10" : ""}`}
        autoComplete="off"
      />

      {showLocateButton && (
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-50"
          title="Use current location"
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Crosshair className="w-5 h-5" />
          )}
        </button>
      )}

      {/* Suggestions dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {isLoading ? (
            <div className="p-3 text-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
              Searching...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="p-3 text-center text-gray-500">
              No results found
            </div>
          ) : (
            <>
              {/* Bus Stops */}
              {suggestions.filter((s) => s.type === "stop").length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50">
                    Bus Stops
                  </div>
                  {suggestions
                    .filter((s) => s.type === "stop")
                    .map((suggestion, index) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => handleSelect(suggestion)}
                        className={`w-full px-3 py-2 text-left flex items-start gap-2 hover:bg-primary-50 transition-colors ${
                          highlightedIndex === index ? "bg-primary-50" : ""
                        }`}
                      >
                        <Bus className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-800">
                            {suggestion.name}
                          </div>
                          {suggestion.routeIds && suggestion.routeIds.length > 0 && (
                            <div className="text-xs text-gray-500">
                              Routes: {suggestion.routeIds.slice(0, 3).join(", ")}
                              {suggestion.routeIds.length > 3 && "..."}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                </div>
              )}

              {/* Addresses */}
              {suggestions.filter((s) => s.type === "address").length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50">
                    Addresses
                  </div>
                  {suggestions
                    .filter((s) => s.type === "address")
                    .map((suggestion, index) => {
                      const stopCount = suggestions.filter((s) => s.type === "stop").length;
                      return (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => handleSelect(suggestion)}
                          className={`w-full px-3 py-2 text-left flex items-start gap-2 hover:bg-primary-50 transition-colors ${
                            highlightedIndex === stopCount + index ? "bg-primary-50" : ""
                          }`}
                        >
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-gray-700">
                            {suggestion.name}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
