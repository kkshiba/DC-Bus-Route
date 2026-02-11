"use client";

import { useEffect, useState } from "react";
import { GeoJSONRoute, GeoJSONStop, RouteResult } from "@/lib/types";
import { geoJSONToCoordinates } from "@/lib/geo-utils";

// Dynamic import for Leaflet to avoid SSR issues
import dynamic from "next/dynamic";

const DAVAO_CENTER: [number, number] = [7.0731, 125.6128];
const DEFAULT_ZOOM = 13;

interface MapProps {
  routes: GeoJSONRoute[];
  stops: GeoJSONStop[];
  selectedRoute?: RouteResult | null;
  userLocation?: { lat: number; lng: number } | null;
  onStopClick?: (stop: GeoJSONStop) => void;
  className?: string;
}

// The actual map component that uses Leaflet + OpenStreetMap
function MapInner({
  routes,
  stops,
  selectedRoute,
  userLocation,
  onStopClick,
  className,
}: MapProps) {
  const [mapReady, setMapReady] = useState(false);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);
  const [ReactLeaflet, setReactLeaflet] = useState<typeof import("react-leaflet") | null>(null);

  useEffect(() => {
    // Dynamic import of Leaflet and react-leaflet
    Promise.all([
      import("leaflet"),
      import("react-leaflet"),
    ]).then(([leaflet, reactLeaflet]) => {
      // Fix default marker icon issue
      delete (leaflet.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });

      setL(leaflet);
      setReactLeaflet(reactLeaflet);
      setMapReady(true);
    });
  }, []);

  if (!mapReady || !L || !ReactLeaflet) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } = ReactLeaflet;

  // Get highlighted route IDs from selected route
  const highlightedRouteIds = new Set(
    selectedRoute?.segments.map((s) => s.routeId) || []
  );

  // Get highlighted stop IDs from selected route
  const highlightedStopIds = new Set<string>();
  if (selectedRoute) {
    for (const segment of selectedRoute.segments) {
      highlightedStopIds.add(segment.boardingStop.properties.stopId);
      highlightedStopIds.add(segment.alightingStop.properties.stopId);
      for (const stop of segment.intermediateStops) {
        highlightedStopIds.add(stop.properties.stopId);
      }
    }
  }

  // Create custom icons
  const createIcon = (color: string) =>
    L.divIcon({
      className: "custom-marker",
      html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

  const greenIcon = createIcon("#22c55e");
  const redIcon = createIcon("#ef4444");
  const yellowIcon = createIcon("#eab308");
  const blueIcon = createIcon("#3b82f6");
  const defaultIcon = L.icon({
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : DAVAO_CENTER;

  return (
    <div className={className}>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/leaflet.css"
      />
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Draw route lines */}
        {routes.map((route) => {
          const isHighlighted = highlightedRouteIds.has(route.properties.routeId);
          const positions: [number, number][] = route.geometry.coordinates.map(
            (coord) => [coord[1], coord[0]]
          );

          return (
            <Polyline
              key={route.properties.routeId}
              positions={positions}
              pathOptions={{
                color: route.properties.color,
                weight: isHighlighted ? 5 : 3,
                opacity: isHighlighted ? 1 : 0.5,
                dashArray: isHighlighted ? undefined : "5, 10",
              }}
            />
          );
        })}

        {/* Draw stop markers */}
        {stops.map((stop) => {
          const coords = geoJSONToCoordinates(stop.geometry.coordinates);
          const position: [number, number] = [coords.lat, coords.lng];

          // Determine marker icon based on role in selected route
          let icon: L.Icon | L.DivIcon = defaultIcon;
          if (selectedRoute) {
            const isBoarding =
              selectedRoute.segments[0]?.boardingStop.properties.stopId ===
              stop.properties.stopId;
            const isAlighting =
              selectedRoute.segments[selectedRoute.segments.length - 1]
                ?.alightingStop.properties.stopId === stop.properties.stopId;
            const isTransfer = selectedRoute.transferPoints.some(
              (t) => t.properties.stopId === stop.properties.stopId
            );

            if (isBoarding) {
              icon = greenIcon;
            } else if (isAlighting) {
              icon = redIcon;
            } else if (isTransfer) {
              icon = yellowIcon;
            }
          }

          return (
            <Marker
              key={stop.properties.stopId}
              position={position}
              icon={icon}
              eventHandlers={{
                click: () => onStopClick?.(stop),
              }}
            >
              <Popup>
                <div className="p-1">
                  <h3 className="font-bold text-sm">
                    {stop.properties.stopName}
                  </h3>
                  {stop.properties.description && (
                    <p className="text-xs text-gray-600 mt-1">
                      {stop.properties.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Routes:{" "}
                    {stop.properties.routeIds
                      .map((id) => id.replace("route-", ""))
                      .join(", ")}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* User location marker */}
        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={10}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#4285F4",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>Your location</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}

// Export with dynamic import to disable SSR
const Map = dynamic(() => Promise.resolve(MapInner), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-gray-100 h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-gray-500">Loading map...</p>
      </div>
    </div>
  ),
});

export { Map };
export default Map;
