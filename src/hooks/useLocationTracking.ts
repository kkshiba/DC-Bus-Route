"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Coordinates } from "@/lib/types";
import { LocationTrackingState } from "@/lib/navigation-types";
import { GEOLOCATION_TIMEOUT_MS } from "@/lib/constants";

interface UseLocationTrackingOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  onLocationUpdate?: (coords: Coordinates) => void;
}

export function useLocationTracking(options: UseLocationTrackingOptions = {}) {
  const {
    enableHighAccuracy = true,
    maximumAge = 0,
    timeout = GEOLOCATION_TIMEOUT_MS,
    onLocationUpdate,
  } = options;

  const [state, setState] = useState<LocationTrackingState>({
    location: null,
    accuracy: null,
    speed: null,
    heading: null,
    error: null,
    isTracking: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Start tracking location
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "Geolocation is not supported by your browser",
        isTracking: false,
      }));
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setState((prev) => ({ ...prev, isTracking: true, error: null }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!isMountedRef.current) return;

        const coords: Coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setState({
          location: coords,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          error: null,
          isTracking: true,
        });

        // Notify callback
        if (onLocationUpdate) {
          onLocationUpdate(coords);
        }
      },
      (error) => {
        if (!isMountedRef.current) return;

        let errorMessage = "An error occurred while tracking your location.";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location access.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isTracking: false,
        }));
      },
      {
        enableHighAccuracy,
        maximumAge,
        timeout,
      }
    );
  }, [enableHighAccuracy, maximumAge, timeout, onLocationUpdate]);

  // Stop tracking location
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  // Get one-time location
  const getCurrentLocation = useCallback((): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: Coordinates = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          if (isMountedRef.current) {
            setState((prev) => ({
              ...prev,
              location: coords,
              accuracy: position.coords.accuracy,
              speed: position.coords.speed,
              heading: position.coords.heading,
              error: null,
            }));
          }

          resolve(coords);
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy,
          maximumAge,
          timeout,
        }
      );
    });
  }, [enableHighAccuracy, maximumAge, timeout]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    startTracking,
    stopTracking,
    getCurrentLocation,
  };
}
