"use client";

import { useState, useEffect } from "react";
import { Bus, Clock } from "lucide-react";

function getBusStatus(): { isActive: boolean; message: string; period: string } {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 60 + minutes; // Convert to minutes

  const AM_START = 6 * 60;   // 06:00
  const AM_END = 10 * 60;    // 10:00
  const PM_START = 16 * 60;  // 16:00
  const PM_END = 21 * 60;    // 21:00

  if (currentTime >= AM_START && currentTime < AM_END) {
    return { isActive: true, message: "AM routes are currently running", period: "AM" };
  } else if (currentTime >= PM_START && currentTime < PM_END) {
    return { isActive: true, message: "PM routes are currently running", period: "PM" };
  } else if (currentTime >= AM_END && currentTime < PM_START) {
    return { isActive: false, message: "No active bus service (resumes at 4:00 PM)", period: "midday" };
  } else {
    return { isActive: false, message: "No active bus service (resumes at 6:00 AM)", period: "overnight" };
  }
}

export function BusStatusBanner() {
  const [status, setStatus] = useState(getBusStatus());

  useEffect(() => {
    // Update status immediately on mount (in case of hydration mismatch)
    setStatus(getBusStatus());

    const interval = setInterval(() => {
      setStatus(getBusStatus());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`py-2 px-4 text-center text-sm font-medium ${
      status.isActive
        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
        : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
    }`}>
      <div className="flex items-center justify-center gap-2">
        {status.isActive ? <Bus className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        <span>{status.message}</span>
      </div>
    </div>
  );
}

export default BusStatusBanner;
