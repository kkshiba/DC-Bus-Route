"use client";

import Link from "next/link";
import { Map, MessageSquare, Bus, Navigation, MapPin, Clock, HelpCircle } from "lucide-react";

const pages = [
  {
    href: "/route-map",
    icon: Map,
    title: "Route Map",
    description: "Browse routes and plan your trip",
    color: "from-blue-500 to-blue-600",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    href: "/route-map?tab=navigate",
    icon: Navigation,
    title: "Start Navigation",
    description: "Get turn-by-turn directions",
    color: "from-green-500 to-green-600",
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
  },
  {
    href: "/chatbot",
    icon: MessageSquare,
    title: "AI Chatbot",
    description: "Get help finding your route",
    color: "from-purple-500 to-purple-600",
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
];

const userGuideTips = [
  {
    icon: Map,
    title: "Browse Routes",
    description: "View all available bus routes on the interactive map",
  },
  {
    icon: MapPin,
    title: "Plan Your Trip",
    description: "Enter your origin and destination to find the best route",
  },
  {
    icon: Clock,
    title: "Real-time Navigation",
    description: "Follow step-by-step directions with live updates",
  },
  {
    icon: HelpCircle,
    title: "Need Help?",
    description: "Ask the AI Chatbot for route recommendations",
  },
];

export default function Home() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 px-4 py-12">
      {/* Logo/Brand */}
      <div className="text-center mb-12">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
          <Bus className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
          DC Bus Route
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Navigate Davao City with ease
        </p>
      </div>

      {/* Page Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {pages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            {/* Gradient accent */}
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${page.color}`}
            />

            <div className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`w-14 h-14 rounded-xl ${page.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}
                >
                  <page.icon className={`w-7 h-7 ${page.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {page.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {page.description}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* User Guide Section */}
      <div className="mt-12 w-full max-w-4xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center mb-6">
          Quick Guide
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {userGuideTips.map((tip, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center p-4 rounded-xl bg-white/50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                <tip.icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                {tip.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tip.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer tagline */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-12">
        Designed for daily commuters and first-time riders
      </p>
    </div>
  );
}
