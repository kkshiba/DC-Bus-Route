"use client";

import { useState } from "react";
import { Bus, Navigation, ChevronLeft, ChevronRight } from "lucide-react";
import { RoutesSidePanel } from "./RoutesSidePanel";
import { TripPlanner, RouteOptions, NavigationSession } from "./navigation";
import { useNavigationStore } from "@/stores/navigation-store";

interface TabbedSidePanelProps {
  selectedRouteIds: string[];
  onSelectionChange: (routeIds: string[]) => void;
  defaultTab?: TabType;
}

type TabType = "routes" | "navigate";

export function TabbedSidePanel({
  selectedRouteIds,
  onSelectionChange,
  defaultTab = "routes",
}: TabbedSidePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { planningStatus, session } = useNavigationStore();

  // Determine what to show in the Navigate tab
  const renderNavigateContent = () => {
    if (planningStatus === "selecting") {
      return <RouteOptions />;
    }

    if (planningStatus === "navigating" && session) {
      return <NavigationSession />;
    }

    // Default: show trip planner
    return <TripPlanner />;
  };

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
        <div className="flex flex-col items-center pt-6 gap-4">
          <button
            onClick={() => {
              setIsCollapsed(false);
              setActiveTab("routes");
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeTab === "routes"
                ? "bg-primary-100 dark:bg-primary-900/30"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            title="Routes"
          >
            <Bus
              className={`w-5 h-5 ${
                activeTab === "routes"
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            />
          </button>
          <button
            onClick={() => {
              setIsCollapsed(false);
              setActiveTab("navigate");
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeTab === "navigate"
                ? "bg-primary-100 dark:bg-primary-900/30"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            title="Navigate"
          >
            <Navigation
              className={`w-5 h-5 ${
                activeTab === "navigate"
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            />
          </button>
          {selectedRouteIds.length > 0 && activeTab === "routes" && (
            <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
              {selectedRouteIds.length}
            </div>
          )}
        </div>
      )}

      {/* Expanded State */}
      {!isCollapsed && (
        <div className="h-full flex flex-col">
          {/* Tabs Header */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("routes")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors relative ${
                activeTab === "routes"
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <Bus className="w-4 h-4" />
              <span>Routes</span>
              {selectedRouteIds.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold">
                  {selectedRouteIds.length}
                </span>
              )}
              {activeTab === "routes" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("navigate")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors relative ${
                activeTab === "navigate"
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <Navigation className="w-4 h-4" />
              <span>Navigate</span>
              {planningStatus === "navigating" && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
              {activeTab === "navigate" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "routes" ? (
              <RoutesSidePanel
                selectedRouteIds={selectedRouteIds}
                onSelectionChange={onSelectionChange}
                compact
              />
            ) : (
              <div className="h-full overflow-y-auto">
                {renderNavigateContent()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
