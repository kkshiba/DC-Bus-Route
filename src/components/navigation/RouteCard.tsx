"use client";

import { Bus, ArrowRight, MapPin, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/geo-utils";
import type { RouteResult } from "@/lib/types";

interface RouteCardProps {
  route: RouteResult;
  walkingDistance?: number;
  onSelect: () => void;
}

export function RouteCard({ route, walkingDistance = 0, onSelect }: RouteCardProps) {
  const isDirect = route.type === "single";
  const segments = route.segments;
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const hasWalkingTransfer = segments.some((s) => s.walkToNextStop);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header with Badge */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Route Badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isDirect
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : hasWalkingTransfer
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
              }`}
            >
              {isDirect ? "Direct" : hasWalkingTransfer ? "Walk & Transfer" : `${segments.length - 1} Transfer`}
            </span>

            {/* Total stops */}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {route.totalStops} stops
            </span>
          </div>

          {/* Estimated time */}
          {route.estimatedDuration && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              ~{route.estimatedDuration} min
            </span>
          )}
        </div>
      </div>

      {/* Route Visualization */}
      <div className="px-4 py-4 space-y-3">
        {/* Route segments */}
        <div className="flex items-center gap-2 flex-wrap">
          {segments.map((segment, index) => (
            <div key={segment.routeId + index} className="flex items-center gap-2">
              {/* Route indicator */}
              <div className="flex items-center gap-1.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: segment.routeColor + "20" }}
                >
                  <Bus className="w-4 h-4" style={{ color: segment.routeColor }} />
                </div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: segment.routeColor }}
                >
                  {segment.routeName.replace(/DC Bus Route \d+ - /, "")}
                </span>
              </div>

              {/* Arrow to next segment */}
              {index < segments.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-400" />
              )}
            </div>
          ))}
        </div>

        {/* Trip Details */}
        <div className="space-y-2 text-sm">
          {/* Boarding */}
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Board at: </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {firstSegment.boardingStop.properties.stopName}
              </span>
            </div>
          </div>

          {/* Transfer point(s) and walking instructions */}
          {segments.map((segment, index) => {
            // Show walking transfer if this segment requires walking to next stop
            if (segment.walkToNextStop) {
              return (
                <div key={`walk-${index}`}>
                  {/* Get off point */}
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Get off at: </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {segment.walkToNextStop.fromStop.properties.stopName}
                      </span>
                    </div>
                  </div>
                  {/* Walking instruction */}
                  <div className="flex items-start gap-2 mt-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Footprints className="w-3 h-3 text-blue-500" />
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Walk </span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {segment.walkToNextStop.distanceMeters}m
                      </span>
                      <span className="text-gray-500 dark:text-gray-400"> to </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {segment.walkToNextStop.toStop.properties.stopName}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // Show regular transfer point (shared stop)
            if (index < segments.length - 1) {
              return (
                <div key={`transfer-${index}`} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Transfer at: </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {segment.alightingStop.properties.stopName}
                    </span>
                  </div>
                </div>
              );
            }

            return null;
          })}

          {/* Alighting */}
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Get off at: </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {lastSegment.alightingStop.properties.stopName}
              </span>
            </div>
          </div>
        </div>

        {/* Walking distance */}
        {walkingDistance > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <Footprints className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDistance(walkingDistance)} walk to first stop
            </span>
          </div>
        )}
      </div>

      {/* Select Button */}
      <div className="px-4 pb-4">
        <Button
          onClick={onSelect}
          className="w-full h-12 bg-primary-600 hover:bg-primary-700 text-white font-semibold"
        >
          Select This Route
        </Button>
      </div>
    </div>
  );
}
