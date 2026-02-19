"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Bus, MapPin, Clock } from "lucide-react";
import { loadRoutesList, type RouteInfo } from "@/lib/data-loader";

interface RoutesSidePanelProps {
  selectedRouteIds: string[];
  onSelectionChange: (routeIds: string[]) => void;
  compact?: boolean; // Hide header/footer, used for mobile bottom sheet
}

export function RoutesSidePanel({
  selectedRouteIds,
  onSelectionChange,
  compact = false,
}: RoutesSidePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load routes on mount
  useEffect(() => {
    loadRoutesList().then((data) => {
      setRoutes(data);
      setIsLoading(false);
    });
  }, []);

  // Group routes by route number
  const groupedRoutes = routes.reduce((acc, route) => {
    if (!acc[route.routeNumber]) {
      acc[route.routeNumber] = [];
    }
    acc[route.routeNumber].push(route);
    return acc;
  }, {} as Record<string, RouteInfo[]>);

  const handleRouteToggle = (routeId: string) => {
    if (selectedRouteIds.includes(routeId)) {
      onSelectionChange(selectedRouteIds.filter((id) => id !== routeId));
    } else {
      onSelectionChange([...selectedRouteIds, routeId]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(routes.map((r) => r.routeId));
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  // Check if any variant in a group is selected
  const isGroupPartiallySelected = (routeGroup: RouteInfo[]) => {
    return routeGroup.some((r) => selectedRouteIds.includes(r.routeId));
  };

  // Compact mode - just the routes list with action bar
  if (compact) {
    return (
      <div className="flex flex-col h-full">
        {/* Action Bar */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex gap-3">
            <button
              onClick={handleSelectAll}
              className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={handleClearAll}
              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
          {selectedRouteIds.length > 0 && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
              {selectedRouteIds.length} selected
            </span>
          )}
        </div>

        {/* Routes List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : (
            Object.entries(groupedRoutes).map(([routeNumber, routeGroup]) => {
              const isAnySelected = isGroupPartiallySelected(routeGroup);
              const primaryRoute = routeGroup[0];

              return (
                <div
                  key={routeNumber}
                  className={`
                    rounded-xl overflow-hidden border-2 transition-all duration-200
                    ${
                      isAnySelected
                        ? "border-primary-300 dark:border-primary-600 shadow-md"
                        : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                    }
                  `}
                >
                  {/* Route Card Header */}
                  <div
                    className={`
                      relative p-3 transition-colors
                      ${
                        isAnySelected
                          ? "bg-primary-50 dark:bg-primary-900/20"
                          : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                      }
                    `}
                  >
                    {/* Color Accent Bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                      style={{ backgroundColor: primaryRoute.color }}
                    />

                    <div className="flex items-center gap-3 pl-2">
                      {/* Bus Icon with Route Color */}
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: primaryRoute.color + "20" }}
                      >
                        <Bus
                          className="w-6 h-6"
                          style={{ color: primaryRoute.color }}
                        />
                      </div>

                      {/* Route Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-bold text-lg"
                            style={{ color: primaryRoute.color }}
                          >
                            {routeNumber}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {primaryRoute.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Time Period Variants */}
                  <div className="flex border-t border-gray-100 dark:border-gray-700">
                    {routeGroup.map((route, idx) => {
                      const isSelected = selectedRouteIds.includes(route.routeId);
                      return (
                        <button
                          key={route.routeId}
                          onClick={() => handleRouteToggle(route.routeId)}
                          className={`
                            flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 text-sm font-medium
                            transition-all duration-200
                            ${idx > 0 ? "border-l border-gray-100 dark:border-gray-700" : ""}
                            ${
                              isSelected
                                ? "bg-primary-600 text-white"
                                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750"
                            }
                          `}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{route.timePeriod || "All Day"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Stats */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>{Object.keys(groupedRoutes).length} routes available</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        relative flex-shrink-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        transition-all duration-300 ease-in-out shadow-sm
        ${isCollapsed ? "w-14" : "w-80"}
      `}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-all hover:scale-110"
        aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        )}
      </button>

      {/* Collapsed State */}
      {isCollapsed && (
        <div className="flex flex-col items-center pt-6 gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Bus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 [writing-mode:vertical-lr] rotate-180">
            Routes
          </span>
          {selectedRouteIds.length > 0 && (
            <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
              {selectedRouteIds.length}
            </div>
          )}
        </div>
      )}

      {/* Expanded State */}
      {!isCollapsed && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Bus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  Bus Routes
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Select routes to view on map
                </p>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
            <div className="flex gap-3">
              <button
                onClick={handleSelectAll}
                className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={handleClearAll}
                className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Clear
              </button>
            </div>
            {selectedRouteIds.length > 0 && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                {selectedRouteIds.length} selected
              </span>
            )}
          </div>

          {/* Routes List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : (
              Object.entries(groupedRoutes).map(([routeNumber, routeGroup]) => {
                const isAnySelected = isGroupPartiallySelected(routeGroup);
                const primaryRoute = routeGroup[0];

                return (
                  <div
                    key={routeNumber}
                    className={`
                      rounded-xl overflow-hidden border-2 transition-all duration-200
                      ${
                        isAnySelected
                          ? "border-primary-300 dark:border-primary-600 shadow-md"
                          : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                      }
                    `}
                  >
                    {/* Route Card Header */}
                    <div
                      className={`
                        relative p-3 transition-colors
                        ${
                          isAnySelected
                            ? "bg-primary-50 dark:bg-primary-900/20"
                            : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                        }
                      `}
                    >
                      {/* Color Accent Bar */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                        style={{ backgroundColor: primaryRoute.color }}
                      />

                      <div className="flex items-center gap-3 pl-2">
                        {/* Bus Icon with Route Color */}
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: primaryRoute.color + "20" }}
                        >
                          <Bus
                            className="w-6 h-6"
                            style={{ color: primaryRoute.color }}
                          />
                        </div>

                        {/* Route Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-bold text-lg"
                              style={{ color: primaryRoute.color }}
                            >
                              {routeNumber}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {primaryRoute.name}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Time Period Variants */}
                    <div className="flex border-t border-gray-100 dark:border-gray-700">
                      {routeGroup.map((route, idx) => {
                        const isSelected = selectedRouteIds.includes(route.routeId);
                        return (
                          <button
                            key={route.routeId}
                            onClick={() => handleRouteToggle(route.routeId)}
                            className={`
                              flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 text-sm font-medium
                              transition-all duration-200
                              ${idx > 0 ? "border-l border-gray-100 dark:border-gray-700" : ""}
                              ${
                                isSelected
                                  ? "bg-primary-600 text-white"
                                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750"
                              }
                            `}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>{route.timePeriod || "All Day"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Stats */}
          <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{Object.keys(groupedRoutes).length} routes available</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
