"use client";

import { useNavigationStore } from "@/stores/navigation-store";
import { NavigationMilestone, MilestoneType } from "@/lib/navigation-types";
import { Check, Circle, Bus, ArrowRightLeft, MapPin } from "lucide-react";

interface MilestoneIconProps {
  type: MilestoneType;
  completed: boolean;
  isCurrent: boolean;
  color: string;
}

function MilestoneIcon({ type, completed, isCurrent, color }: MilestoneIconProps) {
  const baseClass = "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0";

  if (completed) {
    return (
      <div className={`${baseClass} bg-green-500 text-white`}>
        <Check className="w-5 h-5" />
      </div>
    );
  }

  if (isCurrent) {
    return (
      <div
        className={`${baseClass} ring-4 ring-opacity-50`}
        style={{
          backgroundColor: color,
          // @ts-expect-error CSS custom property for ring color
          "--tw-ring-color": color,
        }}
      >
        {type === "boarding" && <Bus className="w-5 h-5 text-white" />}
        {type === "transfer" && <ArrowRightLeft className="w-5 h-5 text-white" />}
        {type === "alighting" && <MapPin className="w-5 h-5 text-white" />}
        {type === "intermediate" && <Circle className="w-3 h-3 text-white fill-white" />}
      </div>
    );
  }

  return (
    <div className={`${baseClass} bg-gray-200 dark:bg-gray-700`}>
      {type === "boarding" && <Bus className="w-5 h-5 text-gray-400" />}
      {type === "transfer" && <ArrowRightLeft className="w-5 h-5 text-gray-400" />}
      {type === "alighting" && <MapPin className="w-5 h-5 text-gray-400" />}
      {type === "intermediate" && <Circle className="w-3 h-3 text-gray-400" />}
    </div>
  );
}

interface MilestoneItemProps {
  milestone: NavigationMilestone;
  isCurrent: boolean;
  isLast: boolean;
  showIntermediates: boolean;
}

function MilestoneItem({ milestone, isCurrent, isLast, showIntermediates }: MilestoneItemProps) {
  // Skip intermediate stops if not showing them
  if (milestone.type === "intermediate" && !showIntermediates) {
    return null;
  }

  const isMinor = milestone.type === "intermediate";

  return (
    <div className="flex gap-3">
      {/* Icon column */}
      <div className="flex flex-col items-center">
        <MilestoneIcon
          type={milestone.type}
          completed={milestone.completed}
          isCurrent={isCurrent}
          color={milestone.routeColor}
        />
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-[24px] ${
              milestone.completed
                ? "bg-green-500"
                : isCurrent
                ? `bg-gradient-to-b from-green-500 to-gray-300 dark:to-gray-600`
                : "bg-gray-300 dark:bg-gray-600"
            }`}
          />
        )}
      </div>

      {/* Content column */}
      <div className={`flex-1 ${isMinor ? "pb-2" : "pb-4"}`}>
        <div
          className={`${
            isCurrent
              ? "text-gray-900 dark:text-white font-semibold"
              : milestone.completed
              ? "text-gray-500 dark:text-gray-400"
              : "text-gray-600 dark:text-gray-300"
          } ${isMinor ? "text-sm" : "text-base"}`}
        >
          {milestone.stopName}
        </div>

        {!isMinor && (
          <div className="flex items-center gap-2 mt-1">
            <div
              className="px-2 py-0.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: milestone.routeColor }}
            >
              {milestone.routeName}
            </div>
            {milestone.type === "boarding" && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Board here</span>
            )}
            {milestone.type === "transfer" && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Transfer here</span>
            )}
            {milestone.type === "alighting" && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Get off here</span>
            )}
          </div>
        )}

        {milestone.completedAt && (
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            Completed at{" "}
            {milestone.completedAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface MilestonesTimelineProps {
  showIntermediates?: boolean;
  maxHeight?: string;
}

export function MilestonesTimeline({
  showIntermediates = false,
  maxHeight = "300px",
}: MilestonesTimelineProps) {
  const session = useNavigationStore((state) => state.session);

  if (!session) return null;

  const { milestones, currentMilestoneIndex } = session;

  // Filter milestones if not showing intermediates
  const displayMilestones = showIntermediates
    ? milestones
    : milestones.filter((m) => m.type !== "intermediate");

  return (
    <div
      className="overflow-y-auto bg-white dark:bg-gray-800 rounded-lg p-4"
      style={{ maxHeight }}
    >
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
        Your Journey
      </h3>
      <div>
        {displayMilestones.map((milestone, index) => {
          // Find the actual index in the full milestones array
          const actualIndex = milestones.findIndex((m) => m.id === milestone.id);
          return (
            <MilestoneItem
              key={milestone.id}
              milestone={milestone}
              isCurrent={actualIndex === currentMilestoneIndex}
              isLast={index === displayMilestones.length - 1}
              showIntermediates={showIntermediates}
            />
          );
        })}
      </div>
    </div>
  );
}
