"use client";

import { useNavigationStore } from "@/stores/navigation-store";
import { NavigationStatus } from "@/lib/navigation-types";
import { formatDistance } from "@/lib/geo-utils";
import { Footprints, Clock, Bus, ArrowRightLeft, CheckCircle2, XCircle } from "lucide-react";

interface StatusConfig {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bgColor: string;
  textColor: string;
}

function getStatusConfig(
  status: NavigationStatus,
  currentStopName: string,
  routeName: string,
  stopsRemaining: number
): StatusConfig {
  const iconClass = "w-6 h-6";

  switch (status) {
    case "walking_to_stop":
      return {
        icon: <Footprints className={iconClass} />,
        title: "Walk to stop",
        subtitle: currentStopName,
        bgColor: "bg-blue-500",
        textColor: "text-white",
      };
    case "waiting_for_bus":
      return {
        icon: <Clock className={iconClass} />,
        title: "Wait for bus",
        subtitle: `${routeName} at ${currentStopName}`,
        bgColor: "bg-yellow-500",
        textColor: "text-black",
      };
    case "riding":
      return {
        icon: <Bus className={iconClass} />,
        title: `Riding ${routeName}`,
        subtitle: `${stopsRemaining} stop${stopsRemaining !== 1 ? "s" : ""} remaining`,
        bgColor: "bg-green-500",
        textColor: "text-white",
      };
    case "transferring":
      return {
        icon: <ArrowRightLeft className={iconClass} />,
        title: "Transfer",
        subtitle: `Walk to ${currentStopName}`,
        bgColor: "bg-purple-500",
        textColor: "text-white",
      };
    case "completed":
      return {
        icon: <CheckCircle2 className={iconClass} />,
        title: "You have arrived!",
        subtitle: currentStopName,
        bgColor: "bg-green-600",
        textColor: "text-white",
      };
    case "cancelled":
      return {
        icon: <XCircle className={iconClass} />,
        title: "Navigation cancelled",
        subtitle: "",
        bgColor: "bg-gray-500",
        textColor: "text-white",
      };
    default:
      return {
        icon: <Bus className={iconClass} />,
        title: "Navigating",
        subtitle: "",
        bgColor: "bg-primary-600",
        textColor: "text-white",
      };
  }
}

export function NavigationStatusBar() {
  const session = useNavigationStore((state) => state.session);
  const getCurrentMilestone = useNavigationStore((state) => state.getCurrentMilestone);

  if (!session) return null;

  const currentMilestone = getCurrentMilestone();
  const stopsRemaining = session.milestones.filter(
    (m) => !m.completed && m.type !== "intermediate"
  ).length;

  const config = getStatusConfig(
    session.status,
    currentMilestone?.stopName || "",
    currentMilestone?.routeName || "",
    stopsRemaining
  );

  return (
    <div className={`${config.bgColor} ${config.textColor} p-4 shadow-lg`}>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{config.title}</h2>
          {config.subtitle && (
            <p className="text-sm opacity-90 truncate">{config.subtitle}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-sm font-medium">
            {formatDistance(session.distanceRemaining)}
          </div>
        </div>
      </div>
    </div>
  );
}
