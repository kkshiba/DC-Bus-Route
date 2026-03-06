import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadRouteData, getRawGeoJSON } from "./data-loader";
import { findRoute, findAllRoutes, getRouteDirections } from "./route-algorithm";
import { findNearestStop, findStopsWithinRadius, formatDistance, formatDuration } from "./geo-utils";
import type { GeoJSONStop, GeoJSONRoute, Coordinates, RouteResult } from "./types";

// ============ SMART RESPONSE HELPER FUNCTIONS ============

function formatWalkingTransferNote(result: RouteResult): string | null {
  for (const segment of result.segments) {
    if (segment.walkToNextStop) {
      const { fromStop, toStop, distanceMeters } = segment.walkToNextStop;
      return `⚠️ Requires ${distanceMeters}m walk from ${fromStop.properties.stopName} to ${toStop.properties.stopName}`;
    }
  }
  return null;
}

function formatRouteComparison(results: RouteResult[]): string {
  if (results.length === 0) return "No routes found.";
  return results.map((r, i) => {
    const hasWalking = r.segments.some(s => s.walkToNextStop);
    const duration = formatDuration(r.estimatedDuration || 0);
    const type = r.type === "single" ? "Direct" : hasWalking ? "Walk & Transfer" : "Transfer";
    const transfers = r.segments.length - 1;
    return `Option ${i + 1}: ${type} (~${duration}${transfers > 0 ? `, ${transfers} transfer` : ""})`;
  }).join("\n");
}

function getTimeContext(): { period: "AM" | "PM"; message: string } {
  const hour = new Date().getHours();
  const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (hour >= 5 && hour < 12) {
    return { period: "AM", message: `Current time: ${time} - AM routes are active` };
  }
  return { period: "PM", message: `Current time: ${time} - PM routes are active` };
}

function formatNearbyStops(userLocation: Coordinates, stops: GeoJSONStop[]): string | null {
  const nearby = findStopsWithinRadius(userLocation, stops, 0.5);
  if (nearby.length === 0) return null;
  const top3 = nearby.slice(0, 3).map(({ stop, distance }) => {
    const routes = [...new Set(stop.properties.routeIds.map(id => id.split("-")[0]))].join(", ");
    return `• ${stop.properties.stopName} (${formatDistance(distance)}) - Routes: ${routes}`;
  });
  return `Nearby stops:\n${top3.join("\n")}`;
}

// ============ ROUTE HELPERS (fixed for real IDs like R102-AM) ============

/**
 * Get all unique route numbers (e.g. R102, R103, R402...)
 */
async function getAllRouteNumbers(): Promise<string[]> {
  const data = await loadRouteData();
  const numbers = new Set<string>();
  for (const routeId of data.routes.keys()) {
    // routeId is like "R102-AM" → routeNumber is "R102"
    const parts = routeId.split("-");
    if (parts.length >= 2) {
      numbers.add(parts.slice(0, -1).join("-"));
    }
  }
  return Array.from(numbers).sort();
}

/**
 * Get available routes list as a readable string
 */
async function getAvailableRoutesText(): Promise<string> {
  const numbers = await getAllRouteNumbers();
  return numbers.join(", ");
}

/**
 * Get stops for a route number (e.g. "R102").
 * Prefers the time-appropriate variant (AM/PM), falls back to any available.
 */
async function getStopsForRouteNumber(routeNumber: string): Promise<GeoJSONStop[]> {
  const data = await loadRouteData();
  const timeCtx = getTimeContext();

  // Normalize input: allow "102", "R102", "r102"
  const normalized = routeNumber.toUpperCase().replace(/^R?/, "R");

  // Try time-appropriate variant first
  const preferredId = `${normalized}-${timeCtx.period}`;
  if (data.routeStops.has(preferredId)) {
    return data.routeStops.get(preferredId)!;
  }

  // Fall back to any variant with this route number
  for (const [routeId, stops] of data.routeStops.entries()) {
    if (routeId.startsWith(normalized + "-")) {
      return stops;
    }
  }

  return [];
}

/**
 * Get route info for a route number.
 * Returns the time-appropriate variant, or any available.
 */
async function getRouteInfoByNumber(routeNumber: string): Promise<GeoJSONRoute | null> {
  const data = await loadRouteData();
  const timeCtx = getTimeContext();
  const normalized = routeNumber.toUpperCase().replace(/^R?/, "R");

  const preferredId = `${normalized}-${timeCtx.period}`;
  if (data.routes.has(preferredId)) {
    return data.routes.get(preferredId)!;
  }

  for (const [routeId, route] of data.routes.entries()) {
    if (routeId.startsWith(normalized + "-")) {
      return route;
    }
  }

  return null;
}

// ============ CONVERSATION CONTEXT MEMORY ============

let lastMentionedStop: GeoJSONStop | null = null;
let lastAction: "directions" | "route_info" | "stop_list" | null = null;

function setContext(stop: GeoJSONStop | null, action: "directions" | "route_info" | "stop_list" | null) {
  lastMentionedStop = stop;
  lastAction = action;
}

function clearContext() {
  lastMentionedStop = null;
  lastAction = null;
}

// ============ TYPES ============

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// ============ GEMINI SETUP ============

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
);

async function getAllStops(): Promise<GeoJSONStop[]> {
  const geojson = await getRawGeoJSON();
  return geojson.features.filter(f => f.geometry.type === "Point") as GeoJSONStop[];
}

async function getAllRoutes(): Promise<GeoJSONRoute[]> {
  const geojson = await getRawGeoJSON();
  return geojson.features.filter(f => f.geometry.type === "LineString") as GeoJSONRoute[];
}

async function buildSystemContext(userLocation: Coordinates | null): Promise<string> {
  const stops = await getAllStops();
  const routes = await getAllRoutes();

  // Deduplicate stops by name for the prompt (stops appear once per route variant)
  const uniqueStopNames = new Set<string>();
  const stopsList = stops
    .filter(s => {
      if (uniqueStopNames.has(s.properties.stopName)) return false;
      uniqueStopNames.add(s.properties.stopName);
      return true;
    })
    .map(s => {
      const routeNumbers = [...new Set(s.properties.routeIds.map(id => id.split("-")[0]))].join(", ");
      return `- ${s.properties.stopName} (routes: ${routeNumbers})`;
    })
    .join("\n");

  // Group routes by number for cleaner display
  const routesByNumber = new Map<string, GeoJSONRoute[]>();
  for (const r of routes) {
    const num = r.properties.routeId.split("-").slice(0, -1).join("-");
    if (!routesByNumber.has(num)) routesByNumber.set(num, []);
    routesByNumber.get(num)!.push(r);
  }

  const routesList = Array.from(routesByNumber.entries())
    .map(([num, variants]) => {
      const first = variants[0];
      const periods = variants.map(v => v.properties.routeId.split("-").pop()).join("/");
      return `- ${num} (${periods}): ${first.properties.routeName} — ${first.properties.description || ""}`;
    })
    .join("\n");

  let locationContext = "";
  if (userLocation) {
    const nearest = findNearestStop(userLocation, stops);
    if (nearest) {
      locationContext = `\n\nUser's nearest stop: ${nearest.stop.properties.stopName} (${formatDistance(nearest.distance)} away).`;
    }
    const nearbyInfo = formatNearbyStops(userLocation, stops);
    if (nearbyInfo) locationContext += `\n\n${nearbyInfo}`;
  }

  const timeCtx = getTimeContext();

  return `You are a helpful assistant for DC Bus Route in Davao City, Philippines. Help commuters navigate the DC Bus system.

AVAILABLE BUS ROUTES (each has AM and PM variants):
${routesList}

AVAILABLE BUS STOPS:
${stopsList}

IMPORTANT GUIDELINES:
1. Route IDs use format like R102-AM, R103-PM. When mentioning routes to users, say "R102 (AM)" or just "R102".
2. When users ask about getting from one place to another, suggest which route(s) to take and where to board/alight.
3. If a transfer is needed, clearly explain the transfer point.
4. Be friendly and helpful using simple language.
5. If unsure, say so politely.
6. Keep responses concise but informative.
7. Use emojis sparingly (🚌 📍 etc).${locationContext}

${timeCtx.message}

Remember: You are specifically helping with DC Bus routes in Davao City.`;
}

async function findStopByName(name: string): Promise<GeoJSONStop | null> {
  const stops = await getAllStops();
  const lowerName = name.toLowerCase().trim().replace(/[?!.,]+$/, "");

  let stop = stops.find(s => s.properties.stopName.toLowerCase() === lowerName);
  if (!stop) stop = stops.find(s => s.properties.stopName.toLowerCase().includes(lowerName));
  if (!stop) stop = stops.find(s => lowerName.includes(s.properties.stopName.toLowerCase()));
  return stop || null;
}

function extractFromTo(message: string): { from: string; to: string } | null {
  const questionWords = ["what", "which", "how", "where", "when", "do", "does", "can", "is", "are", "tell", "show", "find", "routes", "route", "stops", "stop"];

  const fromToMatch = message.match(/from\s+(.+?)\s+to\s+(.+)/i);
  if (fromToMatch) {
    const from = fromToMatch[1].trim();
    const to = fromToMatch[2].trim().replace(/[?!.,]+$/, "");
    if (!questionWords.some(w => from.toLowerCase().startsWith(w))) {
      return { from, to };
    }
  }

  const toMatch = message.match(/(.+?)\s+to\s+(.+)/i);
  if (toMatch) {
    const from = toMatch[1].trim();
    const to = toMatch[2].trim().replace(/[?!.,]+$/, "");
    const fromLower = from.toLowerCase();
    if (from.length > 2 && !questionWords.some(w => fromLower.includes(w))) {
      return { from, to };
    }
  }

  return null;
}

function extractDestination(message: string): string | null {
  const patterns = [
    /(?:go|going|get|getting)\s+to\s+(.+?)(?:\?|$|please|thanks|,)/i,
    /routes?\s+(?:to|for|going\s+to)\s+(.+?)(?:\?|$|please|thanks|,)/i,
    /(?:want|need|like)\s+to\s+(?:go|visit|travel|get)\s+(?:to\s+)?(.+?)(?:\?|$|please|thanks|,)/i,
    /how\s+(?:to|do\s+i|can\s+i)\s+reach\s+(.+?)(?:\?|$|please|thanks|,)/i,
    /directions?\s+(?:to|for)\s+(.+?)(?:\?|$|please|thanks|,)/i,
    /(?:take|bring)\s+me\s+to\s+(.+?)(?:\?|$|please|thanks|,)/i,
    /head(?:ing|ed)?\s+to\s+(.+?)(?:\?|$|please|thanks|,)/i,
    /\bto\s+([a-zA-Z][a-zA-Z\s]+?)(?:\?|$|please|thanks)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      let destination = match[1].trim().replace(/[?!.,]+$/, "");
      destination = destination.replace(/^(the|a|an)\s+/i, "");
      if (destination.length > 1 && !/^(there|here|it|that|this)$/i.test(destination)) {
        return destination;
      }
    }
  }
  return null;
}

/**
 * Extract route number from message (handles "R102", "102", "route 102", "route R102")
 */
function extractRouteNumber(message: string): string | null {
  // Match "R102", "R103", "R402" etc.
  const directMatch = message.match(/\bR(\d{3})\b/i);
  if (directMatch) return `R${directMatch[1]}`;

  // Match "route 102", "route R102"
  const routeWordMatch = message.match(/route\s+R?(\d{3})\b/i);
  if (routeWordMatch) return `R${routeWordMatch[1]}`;

  return null;
}

async function getRouteContext(message: string, userLocation: Coordinates | null): Promise<string> {
  const lowerMessage = message.toLowerCase();
  let additionalContext = "";

  // Nearest/nearby stops
  if (lowerMessage.includes("nearest") || lowerMessage.includes("closest") ||
      lowerMessage.includes("near me") || lowerMessage.includes("nearby")) {
    if (userLocation) {
      const stops = await getAllStops();
      const nearest = findNearestStop(userLocation, stops);
      if (nearest) {
        const routes = [...new Set(nearest.stop.properties.routeIds.map(id => id.split("-")[0]))].join(", ");
        additionalContext = `\n\n[SYSTEM DATA: Nearest stop to user is ${nearest.stop.properties.stopName} (${formatDistance(nearest.distance)} away). Routes: ${routes}]`;
      }
    } else {
      additionalContext = `\n\n[SYSTEM DATA: User location not available. Ask them to enable location services or specify their starting point.]`;
    }
  }

  // Routes to a destination ("what routes go to X")
  const routesToPattern = /(?:what|which)\s+routes?\s+(?:go(?:es)?|serve[sd]?|stop[s]?)\s+(?:to|at)\s+(.+)/i;
  const routesToMatch = message.match(routesToPattern);
  if (routesToMatch) {
    const destination = routesToMatch[1].trim().replace(/[?!.,]+$/, "");
    const stop = await findStopByName(destination);
    if (stop) {
      const routeNumbers = [...new Set(stop.properties.routeIds.map(id => id.split("-")[0]))].join(", ");
      additionalContext = `\n\n[SYSTEM DATA: "${stop.properties.stopName}" is served by routes: ${routeNumbers}]`;
    } else {
      const available = await getAvailableRoutesText();
      additionalContext = `\n\n[SYSTEM DATA: No stop matching "${destination}" found. Available routes: ${available}]`;
    }
    return additionalContext;
  }

  // Stops on a route ("stops on R102", "R102 stops")
  const routeNumber = extractRouteNumber(message);
  const stopsOnRoutePattern = /(?:stops?|destinations?)\s+(?:on|for|along)/i;
  const routeStopsPattern = /stops?\s+(?:on|for)\s+(?:route\s+)?R?\d{3}/i;
  if (routeNumber && (stopsOnRoutePattern.test(message) || routeStopsPattern.test(message) ||
      lowerMessage.includes("stop") || lowerMessage.includes("station"))) {
    const stops = await getStopsForRouteNumber(routeNumber);
    if (stops.length > 0) {
      const timeCtx = getTimeContext();
      additionalContext = `\n\n[SYSTEM DATA: ${routeNumber} (${timeCtx.period}) has ${stops.length} stops: ${stops.map(s => s.properties.stopName).join(", ")}]`;
    } else {
      const available = await getAvailableRoutesText();
      additionalContext = `\n\n[SYSTEM DATA: Route ${routeNumber} not found. Available routes: ${available}]`;
    }
    return additionalContext;
  }

  // Route info ("about R102", "R102 info")
  const routeInfoPattern = /(?:tell\s+me\s+)?about\s+(?:route\s+)?R?\d{3}|(?:route\s+)?R?\d{3}\s+(?:info|information|details)/i;
  if (routeNumber && routeInfoPattern.test(message)) {
    const route = await getRouteInfoByNumber(routeNumber);
    if (route) {
      const stops = await getStopsForRouteNumber(routeNumber);
      additionalContext = `\n\n[SYSTEM DATA: ${routeNumber} — Name: ${route.properties.routeName}, Stops: ${stops.length}, Description: ${route.properties.description || "N/A"}, Stop list: ${stops.map(s => s.properties.stopName).join(", ")}]`;
    } else {
      const available = await getAvailableRoutesText();
      additionalContext = `\n\n[SYSTEM DATA: Route ${routeNumber} not found. Available: ${available}]`;
    }
    return additionalContext;
  }

  // How do I get to X (destination only, uses user location)
  const getToPattern = /how\s+(?:do\s+I\s+|to\s+|can\s+I\s+)?(?:get|go|travel|commute)\s+to\s+(.+)/i;
  const getToMatch = message.match(getToPattern);
  if (getToMatch) {
    const destination = getToMatch[1].trim().replace(/[?!.,]+$/, "");
    const toStop = await findStopByName(destination);

    if (!toStop) {
      additionalContext = `\n\n[SYSTEM DATA: No stop matching "${destination}" found. Suggest listing all stops.]`;
      return additionalContext;
    }
    if (!userLocation) {
      additionalContext = `\n\n[SYSTEM DATA: Found "${toStop.properties.stopName}" but user location unavailable. Ask for starting point.]`;
      return additionalContext;
    }

    const stops = await getAllStops();
    const nearest = findNearestStop(userLocation, stops);
    if (nearest) {
      const routeData = await loadRouteData();
      const results = findAllRoutes({
        origin: { lat: nearest.stop.geometry.coordinates[1], lng: nearest.stop.geometry.coordinates[0] },
        destination: { lat: toStop.geometry.coordinates[1], lng: toStop.geometry.coordinates[0] },
      }, routeData, 3);

      if (results.length > 0) {
        const timeCtx = getTimeContext();
        additionalContext = `\n\n[SYSTEM DATA: Routes from user's nearest stop (${nearest.stop.properties.stopName}, ${formatDistance(nearest.distance)} away) to ${toStop.properties.stopName}:\n${timeCtx.message}\n${formatRouteComparison(results)}\n\nDirections:\n${getRouteDirections(results[0]).map((d, i) => `  ${i + 1}. ${d}`).join("\n")}${formatWalkingTransferNote(results[0]) ? "\n" + formatWalkingTransferNote(results[0]) : ""}]`;
      } else {
        additionalContext = `\n\n[SYSTEM DATA: Nearest stop is ${nearest.stop.properties.stopName}, destination is ${toStop.properties.stopName}, but no route found between them.]`;
      }
    }
    return additionalContext;
  }

  // From X to Y
  const fromTo = extractFromTo(message);
  if (fromTo) {
    const fromStop = await findStopByName(fromTo.from);
    const toStop = await findStopByName(fromTo.to);

    if (fromStop && toStop) {
      const routeData = await loadRouteData();
      const results = findAllRoutes({
        origin: { lat: fromStop.geometry.coordinates[1], lng: fromStop.geometry.coordinates[0] },
        destination: { lat: toStop.geometry.coordinates[1], lng: toStop.geometry.coordinates[0] },
      }, routeData, 3);

      if (results.length > 0) {
        const timeCtx = getTimeContext();
        additionalContext = `\n\n[SYSTEM DATA: Routes from ${fromStop.properties.stopName} to ${toStop.properties.stopName}:\n${timeCtx.message}\n${formatRouteComparison(results)}\n\nDirections:\n${getRouteDirections(results[0]).map((d, i) => `  ${i + 1}. ${d}`).join("\n")}${formatWalkingTransferNote(results[0]) ? "\n" + formatWalkingTransferNote(results[0]) : ""}]`;
      } else {
        additionalContext = `\n\n[SYSTEM DATA: No route found between "${fromTo.from}" and "${fromTo.to}".]`;
      }
    } else {
      if (!fromStop) additionalContext = `\n\n[SYSTEM DATA: No stop matching "${fromTo.from}" found.]`;
      else if (!toStop) additionalContext = `\n\n[SYSTEM DATA: No stop matching "${fromTo.to}" found.]`;
    }
  }

  // Flexible destination extraction
  if (!additionalContext) {
    const destination = extractDestination(message);
    if (destination) {
      const toStop = await findStopByName(destination);
      if (toStop) {
        if (!userLocation) {
          additionalContext = `\n\n[SYSTEM DATA: User asking about routes to ${toStop.properties.stopName}. Location unavailable — suggest specifying starting point.]`;
        } else {
          const stops = await getAllStops();
          const nearest = findNearestStop(userLocation, stops);
          if (nearest) {
            const routeData = await loadRouteData();
            const results = findAllRoutes({
              origin: { lat: nearest.stop.geometry.coordinates[1], lng: nearest.stop.geometry.coordinates[0] },
              destination: { lat: toStop.geometry.coordinates[1], lng: toStop.geometry.coordinates[0] },
            }, routeData, 3);

            if (results.length > 0) {
              const timeCtx = getTimeContext();
              additionalContext = `\n\n[SYSTEM DATA: Routes from user's nearest stop (${nearest.stop.properties.stopName}, ${formatDistance(nearest.distance)} away) to ${toStop.properties.stopName}:\n${timeCtx.message}\n${formatRouteComparison(results)}\n\nDirections:\n${getRouteDirections(results[0]).map((d, i) => `  ${i + 1}. ${d}`).join("\n")}${formatWalkingTransferNote(results[0]) ? "\n" + formatWalkingTransferNote(results[0]) : ""}]`;
            } else {
              additionalContext = `\n\n[SYSTEM DATA: Nearest stop is ${nearest.stop.properties.stopName}, destination is ${toStop.properties.stopName}, no route found.]`;
            }
          }
        }
      } else {
        additionalContext = `\n\n[SYSTEM DATA: No stop matching "${destination}" found. Suggest listing all stops.]`;
      }
    }
  }

  return additionalContext;
}

// ============ MAIN RESPONSE FUNCTION ============

export async function getChatbotResponse(
  message: string,
  userLocation: Coordinates | null
): Promise<string> {
  try {
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      return await getFallbackResponse(message, userLocation);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const systemContext = await buildSystemContext(userLocation);
    const routeContext = await getRouteContext(message, userLocation);

    const prompt = `${systemContext}${routeContext}\n\nUser message: ${message}\n\nPlease provide a helpful response based on the DC Bus route information above.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text || "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Gemini API error:", error);
    return await getFallbackResponse(message, userLocation);
  }
}

// ============ FALLBACK RESPONSE FUNCTION ============

async function getFallbackResponse(
  message: string,
  userLocation: Coordinates | null
): Promise<string> {
  const lowerMessage = message.toLowerCase().trim();

  // Greetings
  if (lowerMessage.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
    let greeting = "Hello! I'm here to help you navigate DC Bus routes in Davao City. You can ask me about:\n\n• Nearest bus stops\n• How to get from one place to another\n• List of all bus stops\n• Information about specific routes (R102, R103, R402, etc.)";
    if (userLocation) {
      const stops = await getAllStops();
      const nearbyInfo = formatNearbyStops(userLocation, stops);
      if (nearbyInfo) greeting += `\n\n${nearbyInfo}`;
    }
    greeting += "\n\nHow can I assist you today?";
    return greeting;
  }

  // Thanks
  if (lowerMessage.match(/^(thanks|thank you|salamat)/)) {
    clearContext();
    return "You're welcome! If you have any other questions about DC Bus routes, feel free to ask. Safe travels! 🚌";
  }

  // Yes follow-up
  if (lowerMessage.match(/^(yes|yeah|yep|sure|ok|okay|please|go ahead|yea|yup)$/i)) {
    if (lastMentionedStop && lastAction === "directions") {
      const toStop = lastMentionedStop;
      clearContext();

      if (!userLocation) {
        return `To give you directions to **${toStop.properties.stopName}**, I need your location. Please enable location services, or tell me where you're coming from (e.g., "from Toril District Hall to ${toStop.properties.stopName}").`;
      }

      const stops = await getAllStops();
      const nearest = findNearestStop(userLocation, stops);
      if (!nearest) return `I found ${toStop.properties.stopName}, but couldn't determine your nearest stop. Please specify your starting point.`;

      const routeData = await loadRouteData();
      const results = findAllRoutes({
        origin: { lat: nearest.stop.geometry.coordinates[1], lng: nearest.stop.geometry.coordinates[0] },
        destination: { lat: toStop.geometry.coordinates[1], lng: toStop.geometry.coordinates[0] },
      }, routeData, 3);

      if (results.length === 0) return `Found your nearest stop (${nearest.stop.properties.stopName}) and destination (${toStop.properties.stopName}), but couldn't find a connecting route.`;

      const timeCtx = getTimeContext();
      const directions = getRouteDirections(results[0]);
      const walkingNote = formatWalkingTransferNote(results[0]);

      let response = `**Route to ${toStop.properties.stopName}**\n\n${timeCtx.message}\n\nYour nearest stop: ${nearest.stop.properties.stopName} (${formatDistance(nearest.distance)} away)\n\n**Route Options:**\n${formatRouteComparison(results)}\n\n**Directions:**\n${directions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;
      if (walkingNote) response += `\n\n${walkingNote}`;
      return response;
    }

    clearContext();
    return "I'm not sure what you're saying yes to. Could you ask a specific question like:\n\n• \"How do I get to GE Torres Station?\"\n• \"What routes serve Matina Crossing?\"\n• \"List all stops\"";
  }

  // What routes go to X?
  const routesToPattern = /(?:what|which)\s+routes?\s+(?:go(?:es)?|serve[sd]?|stop[s]?)\s+(?:to|at)\s+(.+)/i;
  const routesToMatch = message.match(routesToPattern);
  if (routesToMatch) {
    const destination = routesToMatch[1].trim().replace(/[?!.,]+$/, "");
    const stop = await findStopByName(destination);
    if (stop) {
      const routeNumbers = [...new Set(stop.properties.routeIds.map(id => id.split("-")[0]))].join(", ");
      setContext(stop, "directions");
      return `**${stop.properties.stopName}** is served by: **${routeNumbers}**\n\nWould you like directions to this stop?`;
    } else {
      clearContext();
      const available = await getAvailableRoutesText();
      return `I couldn't find a stop matching "${destination}".\n\nAvailable routes: ${available}\n\nTry "list all stops" to see all stop names.`;
    }
  }

  // Stops on R102 / R102 stops
  const routeNumber = extractRouteNumber(message);
  const stopsKeywords = ["stop", "station", "destination"];
  if (routeNumber && stopsKeywords.some(k => lowerMessage.includes(k))) {
    const stops = await getStopsForRouteNumber(routeNumber);
    if (stops.length > 0) {
      const timeCtx = getTimeContext();
      const stopList = stops.map((s, i) => `${i + 1}. ${s.properties.stopName}`).join("\n");
      return `**${routeNumber} Stops (${timeCtx.period} route):**\n\n${stopList}\n\nTotal: ${stops.length} stops`;
    } else {
      const available = await getAvailableRoutesText();
      return `I couldn't find Route ${routeNumber}.\n\nAvailable routes: ${available}`;
    }
  }

  // Route info ("about R102", "R102 info")
  if (routeNumber) {
    const route = await getRouteInfoByNumber(routeNumber);
    if (route) {
      const stops = await getStopsForRouteNumber(routeNumber);
      const firstStop = stops[0]?.properties.stopName || "Unknown";
      const lastStop = stops[stops.length - 1]?.properties.stopName || "Unknown";
      return `**Route ${routeNumber} Information:**\n\n• Name: ${route.properties.routeName}\n• From: ${firstStop}\n• To: ${lastStop}\n• Total Stops: ${stops.length}\n• ${route.properties.description || ""}\n\n_Say "R${routeNumber.replace("R", "")} stops" to see all stops._`;
    } else {
      const available = await getAvailableRoutesText();
      return `I couldn't find Route ${routeNumber}.\n\nAvailable routes: ${available}`;
    }
  }

  // How do I get to X?
  const getToPattern = /how\s+(?:do\s+I\s+|to\s+|can\s+I\s+)?(?:get|go|travel|commute)\s+to\s+(.+)/i;
  const getToMatch = message.match(getToPattern);
  if (getToMatch) {
    const destination = getToMatch[1].trim().replace(/[?!.,]+$/, "");
    const toStop = await findStopByName(destination);

    if (!toStop) return `I couldn't find a stop matching "${destination}". Try "list all stops" to see available options.`;
    if (!userLocation) return `To give you directions to **${toStop.properties.stopName}**, I need your location. Please enable location services, or tell me where you're coming from (e.g., "from Toril District Hall Station to ${toStop.properties.stopName}").`;

    const stops = await getAllStops();
    const nearest = findNearestStop(userLocation, stops);
    if (!nearest) return `Found ${toStop.properties.stopName}, but couldn't determine your nearest stop. Please specify your starting point.`;

    const routeData = await loadRouteData();
    const results = findAllRoutes({
      origin: { lat: nearest.stop.geometry.coordinates[1], lng: nearest.stop.geometry.coordinates[0] },
      destination: { lat: toStop.geometry.coordinates[1], lng: toStop.geometry.coordinates[0] },
    }, routeData, 3);

    if (results.length === 0) return `Found your nearest stop (${nearest.stop.properties.stopName}) and destination (${toStop.properties.stopName}), but couldn't find a connecting route.`;

    const timeCtx = getTimeContext();
    const directions = getRouteDirections(results[0]);
    const walkingNote = formatWalkingTransferNote(results[0]);

    let response = `**Route to ${toStop.properties.stopName}**\n\n${timeCtx.message}\n\nYour nearest stop: ${nearest.stop.properties.stopName} (${formatDistance(nearest.distance)} away)\n\n**Route Options:**\n${formatRouteComparison(results)}\n\n**Directions:**\n${directions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;
    if (walkingNote) response += `\n\n${walkingNote}`;
    return response;
  }

  // More stops / all stops near me
  if (lowerMessage.match(/more\s+stops?/) || lowerMessage.match(/(?:all|every)\s+stops?\s+(?:near|nearby)/) || lowerMessage.match(/show\s+more/)) {
    if (!userLocation) return "I need your location to find nearby stops. Please enable location services and try again.";
    const stops = await getAllStops();
    const allNearby = findStopsWithinRadius(userLocation, stops, 2);
    if (allNearby.length === 0) return "Sorry, I couldn't find any stops within 2km of your location.";

    let response = `**All stops near you (${allNearby.length} within 2km):**\n\n`;
    allNearby.forEach((s, i) => {
      const routes = [...new Set(s.stop.properties.routeIds.map(id => id.split("-")[0]))].join(", ");
      response += `${i + 1}. ${s.stop.properties.stopName} (${formatDistance(s.distance)}) — Routes: ${routes}\n\n`;
    });
    return response;
  }

  // Nearest stops
  if (lowerMessage.includes("nearest") || lowerMessage.includes("closest") ||
      lowerMessage.includes("near me") || lowerMessage.includes("nearby") ||
      lowerMessage.match(/stops?\s+near/)) {
    if (!userLocation) return "I need your location to find the nearest stop. Please enable location services and try again.";

    const stops = await getAllStops();
    const allNearby = findStopsWithinRadius(userLocation, stops, 2);
    if (allNearby.length === 0) return "Sorry, I couldn't find any stops near you.";

    const stopsToShow = allNearby.slice(0, 5);
    let response = `**Stops near you:**\n\n`;
    stopsToShow.forEach((s, i) => {
      const routes = [...new Set(s.stop.properties.routeIds.map(id => id.split("-")[0]))].join(", ");
      response += `${i + 1}. ${s.stop.properties.stopName} (${formatDistance(s.distance)}) — Routes: ${routes}\n\n`;
    });
    if (allNearby.length > 5) response += `_Showing 5 of ${allNearby.length} nearby stops. Say "more stops" to see all._`;
    return response;
  }

  // Stops in area
  const stopsInAreaMatch = lowerMessage.match(/(?:stops?|list\s+stops?)\s+(?:in|at|around)\s+(\w+)/i);
  if (stopsInAreaMatch) {
    const areaQuery = stopsInAreaMatch[1].toLowerCase();
    const routeData = await loadRouteData();

    const matchingStops: { stop: GeoJSONStop; routes: string[] }[] = [];
    for (const [stopId, stop] of routeData.stops) {
      const areas = routeData.stopAreas.get(stopId);
      if (areas && Array.from(areas).some(a => a.toLowerCase().includes(areaQuery) || areaQuery.includes(a.toLowerCase()))) {
        const routes = [...new Set(stop.properties.routeIds.map(id => id.split("-")[0]))];
        matchingStops.push({ stop, routes });
      }
    }

    if (matchingStops.length === 0) {
      return `No stops found in "${stopsInAreaMatch[1]}". Try "list all stops" to see stops grouped by area.`;
    }

    let response = `**Stops in ${stopsInAreaMatch[1]} (${matchingStops.length} stops):**\n\n`;
    matchingStops.forEach((s, i) => {
      response += `${i + 1}. ${s.stop.properties.stopName} — Routes: ${s.routes.join(", ")}\n\n`;
    });
    return response;
  }

  // List all stops
  if (lowerMessage.includes("all stops") || lowerMessage.includes("list stops") ||
      lowerMessage.includes("show stops") || lowerMessage.includes("what stops") ||
      lowerMessage.includes("available stops")) {
    const routeData = await loadRouteData();
    const stopsByArea = new Map<string, GeoJSONStop[]>();

    for (const [stopId, stop] of routeData.stops) {
      const areas = routeData.stopAreas.get(stopId) || new Set();
      for (const area of areas) {
        if (!stopsByArea.has(area)) stopsByArea.set(area, []);
        if (!stopsByArea.get(area)!.some(s => s.properties.stopId === stopId)) {
          stopsByArea.get(area)!.push(stop);
        }
      }
    }

    const sortedAreas = Array.from(stopsByArea.keys()).sort();
    let response = `**DC Bus Stops by Area:**\n\n`;

    for (const area of sortedAreas) {
      const stops = stopsByArea.get(area)!;
      const stopNames = stops.slice(0, 4).map(s => s.properties.stopName).join(", ");
      const moreText = stops.length > 4 ? `, +${stops.length - 4} more` : "";
      response += `📍 **${area}** (${stops.length} stops)\n   ${stopNames}${moreText}\n\n`;
    }

    response += `**Total:** ${routeData.stops.size} stops\n\n_Say "stops in [area]" for the full list._`;
    return response;
  }

  // List all routes
  if (lowerMessage.includes("all routes") || lowerMessage.includes("list routes") ||
      lowerMessage.includes("available routes") || lowerMessage.includes("what routes")) {
    const available = await getAvailableRoutesText();
    const routeData = await loadRouteData();
    const timeCtx = getTimeContext();

    let response = `**Available DC Bus Routes (${timeCtx.period} active):**\n\n`;
    const seen = new Set<string>();
    for (const route of routeData.routes.values()) {
      const num = route.properties.routeId.split("-").slice(0, -1).join("-");
      if (!seen.has(num)) {
        seen.add(num);
        response += `🚌 **${num}** — ${route.properties.routeName}\n`;
      }
    }
    return response;
  }

  // Route finding (from X to Y)
  const fromTo = extractFromTo(message);
  if (fromTo) {
    const fromStop = await findStopByName(fromTo.from);
    const toStop = await findStopByName(fromTo.to);

    if (!fromStop) return `I couldn't find a stop matching "${fromTo.from}". Try "list all stops" to see available options.`;
    if (!toStop) return `I couldn't find a stop matching "${fromTo.to}". Try "list all stops" to see available options.`;

    const routeData = await loadRouteData();
    const results = findAllRoutes({
      origin: { lat: fromStop.geometry.coordinates[1], lng: fromStop.geometry.coordinates[0] },
      destination: { lat: toStop.geometry.coordinates[1], lng: toStop.geometry.coordinates[0] },
    }, routeData, 3);

    if (results.length === 0) return `Sorry, I couldn't find a route from ${fromStop.properties.stopName} to ${toStop.properties.stopName}.`;

    const timeCtx = getTimeContext();
    const directions = getRouteDirections(results[0]);
    const walkingNote = formatWalkingTransferNote(results[0]);

    let response = `**Route from ${fromStop.properties.stopName} to ${toStop.properties.stopName}**\n\n${timeCtx.message}\n\n**Route Options:**\n${formatRouteComparison(results)}\n\n**Directions:**\n${directions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;
    if (walkingNote) response += `\n\n${walkingNote}`;
    return response;
  }

  // Flexible destination
  const destination = extractDestination(message);
  if (destination) {
    const toStop = await findStopByName(destination);
    if (toStop) {
      if (!userLocation) {
        return `I found **${toStop.properties.stopName}**! To give you directions, please either:\n• Enable location services\n• Tell me where you're coming from (e.g., "from Toril District Hall Station to ${toStop.properties.stopName}")`;
      }

      const stops = await getAllStops();
      const nearest = findNearestStop(userLocation, stops);
      if (!nearest) return `Found ${toStop.properties.stopName}, but couldn't determine your nearest stop. Please specify your starting point.`;

      const routeData = await loadRouteData();
      const results = findAllRoutes({
        origin: { lat: nearest.stop.geometry.coordinates[1], lng: nearest.stop.geometry.coordinates[0] },
        destination: { lat: toStop.geometry.coordinates[1], lng: toStop.geometry.coordinates[0] },
      }, routeData, 3);

      if (results.length === 0) return `Found your nearest stop (${nearest.stop.properties.stopName}) and destination (${toStop.properties.stopName}), but couldn't find a connecting route.`;

      const timeCtx = getTimeContext();
      const directions = getRouteDirections(results[0]);
      const walkingNote = formatWalkingTransferNote(results[0]);

      let response = `**Route to ${toStop.properties.stopName}**\n\n${timeCtx.message}\n\nYour nearest stop: ${nearest.stop.properties.stopName} (${formatDistance(nearest.distance)} away)\n\n**Route Options:**\n${formatRouteComparison(results)}\n\n**Directions:**\n${directions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;
      if (walkingNote) response += `\n\n${walkingNote}`;
      return response;
    } else {
      return `I couldn't find a stop matching "${destination}".\n\nTry:\n• "list all stops" to see available stops\n• Check spelling`;
    }
  }

  // Default
  const available = await getAvailableRoutesText();
  return `I can help you with DC Bus routes in Davao City. Here's what you can ask:\n\n• "Stops near me" — Find stops near your location\n• "From Toril District Hall to GE Torres Station" — Get directions\n• "R102 stops" — See all stops on a route\n• "List all stops" — See all stops by area\n• "What routes go to Matina Crossing?" — Find which routes serve a stop\n\n**Available routes:** ${available}`;
}