import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadRouteData, getRawGeoJSON } from "./data-loader";
import { findRoute, findAllRoutes, getRouteDirections } from "./route-algorithm";
import { findNearestStop, findStopsWithinRadius, formatDistance, formatDuration } from "./geo-utils";
import type { GeoJSONStop, GeoJSONRoute, Coordinates, RouteResult } from "./types";

// ============ SMART RESPONSE HELPER FUNCTIONS ============

/**
 * Format walking transfer note if route requires walking between stops
 */
function formatWalkingTransferNote(result: RouteResult): string | null {
  for (const segment of result.segments) {
    if (segment.walkToNextStop) {
      const { fromStop, toStop, distanceMeters } = segment.walkToNextStop;
      return `⚠️ Requires ${distanceMeters}m walk from ${fromStop.properties.stopName} to ${toStop.properties.stopName}`;
    }
  }
  return null;
}

/**
 * Format multiple route options for comparison
 */
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

/**
 * Get current time context for AM/PM route suggestions
 */
function getTimeContext(): { period: "AM" | "PM"; message: string } {
  const hour = new Date().getHours();
  const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  if (hour >= 5 && hour < 12) {
    return { period: "AM", message: `Current time: ${time} - Showing morning routes` };
  }
  return { period: "PM", message: `Current time: ${time} - Showing afternoon routes` };
}

/**
 * Format nearby stops for user's location
 */
function formatNearbyStops(userLocation: Coordinates, stops: GeoJSONStop[]): string | null {
  const nearby = findStopsWithinRadius(userLocation, stops, 0.5); // 500m radius
  if (nearby.length === 0) return null;

  const top3 = nearby.slice(0, 3).map(({ stop, distance }) => {
    // Get unique route numbers (without AM/PM suffix)
    const routes = [...new Set(stop.properties.routeIds.map(id => id.split("-")[0]))].join(", ");
    return `• ${stop.properties.stopName} (${formatDistance(distance)}) - Routes: ${routes}`;
  });

  return `Nearby stops:\n${top3.join("\n")}`;
}

// ============ END SMART RESPONSE HELPERS ============

// ============ CONVERSATION CONTEXT MEMORY ============
// Simple context memory for handling follow-up responses like "yes"

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

// ============ END CONTEXT MEMORY ============

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
);

// Get all stops from the data
async function getAllStops(): Promise<GeoJSONStop[]> {
  const geojson = await getRawGeoJSON();
  return geojson.features.filter(
    (f) => f.geometry.type === "Point"
  ) as GeoJSONStop[];
}

// Get all routes from the data
async function getAllRoutes(): Promise<GeoJSONRoute[]> {
  const geojson = await getRawGeoJSON();
  return geojson.features.filter(
    (f) => f.geometry.type === "LineString"
  ) as GeoJSONRoute[];
}

// Build system context with route data
async function buildSystemContext(userLocation: Coordinates | null): Promise<string> {
  const stops = await getAllStops();
  const routes = await getAllRoutes();

  const stopsList = stops
    .sort((a, b) => a.properties.order - b.properties.order)
    .map(s => `- ${s.properties.stopName} (served by: ${s.properties.routeIds.map(id => id.replace("route-", "Route ")).join(", ")})`)
    .join("\n");

  const routesList = routes
    .map(r => `- ${r.properties.routeName}: ${r.properties.description || "No description"}`)
    .join("\n");

  let locationContext = "";
  if (userLocation) {
    const nearest = findNearestStop(userLocation, stops);
    if (nearest) {
      locationContext = `\n\nThe user's current location is detected. The nearest stop to them is ${nearest.stop.properties.stopName} (${formatDistance(nearest.distance)} away).`;
    }

    // Add nearby stops info
    const nearbyInfo = formatNearbyStops(userLocation, stops);
    if (nearbyInfo) {
      locationContext += `\n\n${nearbyInfo}`;
    }
  }

  // Add time context
  const timeContext = getTimeContext();
  const timeInfo = `\n\n${timeContext.message}`;

  return `You are a helpful assistant for DC Bus Route in Davao City, Philippines. Your role is to help commuters navigate the DC Bus system.

AVAILABLE BUS ROUTES:
${routesList}

AVAILABLE BUS STOPS:
${stopsList}

TRANSFER POINTS:
- Bankerohan Market - transfer between Route 1 and Route 2
- SM Ecoland - transfer between Route 1 and Route 2

IMPORTANT GUIDELINES:
1. Always provide accurate information based on the stops and routes listed above.
2. When users ask about getting from one place to another, suggest which route(s) to take and where to board/alight.
3. If a transfer is needed, clearly explain the transfer point.
4. Be friendly and helpful, using simple language.
5. If you're unsure about something not in the data, say so politely.
6. Keep responses concise but informative.
7. Use emojis sparingly to make responses friendly (bus emoji, location pin, etc.).${locationContext}${timeInfo}

Remember: You are specifically helping with DC Bus routes in Davao City. Do not provide information about other transportation systems unless comparing or clarifying.`;
}

// Find a stop by name (partial match)
async function findStopByName(name: string): Promise<GeoJSONStop | null> {
  const stops = await getAllStops();
  const lowerName = name.toLowerCase().trim().replace(/[?!.,]+$/, '');

  // Try exact match first
  let stop = stops.find(
    (s) => s.properties.stopName.toLowerCase() === lowerName
  );

  // Try partial match
  if (!stop) {
    stop = stops.find((s) =>
      s.properties.stopName.toLowerCase().includes(lowerName)
    );
  }

  // Try if the search term is contained in stop name
  if (!stop) {
    stop = stops.find((s) =>
      lowerName.includes(s.properties.stopName.toLowerCase())
    );
  }

  return stop || null;
}

// Get all stops for a specific route
async function getStopsForRoute(routeNumber: string): Promise<GeoJSONStop[]> {
  const routeId = `route-${routeNumber}`;
  const routeData = await loadRouteData();
  return routeData.routeStops.get(routeId) || [];
}

// Get route info by route number
async function getRouteByNumber(routeNumber: string): Promise<GeoJSONRoute | null> {
  const routeId = `route-${routeNumber}`;
  const routes = await getAllRoutes();
  return routes.find(r => r.properties.routeId === routeId) || null;
}

// Extract location names from "from X to Y" pattern
function extractFromTo(message: string): { from: string; to: string } | null {
  // Question words that should not be treated as location names
  const questionWords = ['what', 'which', 'how', 'where', 'when', 'do', 'does', 'can', 'is', 'are', 'tell', 'show', 'find', 'routes', 'route', 'stops', 'stop'];

  // Pattern: "from X to Y"
  const fromToMatch = message.match(/from\s+(.+?)\s+to\s+(.+)/i);
  if (fromToMatch) {
    const from = fromToMatch[1].trim();
    const to = fromToMatch[2].trim().replace(/[?!.,]+$/, '');
    // Skip if "from" part starts with question words
    if (!questionWords.some(w => from.toLowerCase().startsWith(w))) {
      return { from, to };
    }
  }

  // Pattern: "X to Y" - but skip if X contains question phrases
  const toMatch = message.match(/(.+?)\s+to\s+(.+)/i);
  if (toMatch) {
    const from = toMatch[1].trim();
    const to = toMatch[2].trim().replace(/[?!.,]+$/, '');
    // Skip if "from" part contains question words or is too short
    const fromLower = from.toLowerCase();
    if (from.length > 2 && !questionWords.some(w => fromLower.includes(w))) {
      return { from, to };
    }
  }

  return null;
}

/**
 * Extract destination from natural language queries
 * Handles various phrasings like "want to go to X", "routes to X", "going to X", etc.
 */
function extractDestination(message: string): string | null {
  // Patterns to match various ways users ask about destinations
  const patterns = [
    // "go to X", "going to X", "get to X"
    /(?:go|going|get|getting)\s+to\s+(.+?)(?:\?|$|please|thanks|,)/i,
    // "routes to X", "route to X"
    /routes?\s+(?:to|for|going\s+to)\s+(.+?)(?:\?|$|please|thanks|,)/i,
    // "want to go to X", "want to visit X", "need to go to X"
    /(?:want|need|like)\s+to\s+(?:go|visit|travel|get)\s+(?:to\s+)?(.+?)(?:\?|$|please|thanks|,)/i,
    // "how to reach X"
    /how\s+(?:to|do\s+i|can\s+i)\s+reach\s+(.+?)(?:\?|$|please|thanks|,)/i,
    // "directions to X"
    /directions?\s+(?:to|for)\s+(.+?)(?:\?|$|please|thanks|,)/i,
    // "take me to X", "bring me to X"
    /(?:take|bring)\s+me\s+to\s+(.+?)(?:\?|$|please|thanks|,)/i,
    // "heading to X", "headed to X"
    /head(?:ing|ed)?\s+to\s+(.+?)(?:\?|$|please|thanks|,)/i,
    // Just "to X" at the end of sentence (last resort)
    /\bto\s+([a-zA-Z][a-zA-Z\s]+?)(?:\?|$|please|thanks)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      let destination = match[1].trim().replace(/[?!.,]+$/, '');
      // Clean up common words that shouldn't be part of destination
      destination = destination.replace(/^(the|a|an)\s+/i, '');
      if (destination.length > 1 && !/^(there|here|it|that|this)$/i.test(destination)) {
        return destination;
      }
    }
  }

  return null;
}

// Get route finding context to add to AI prompt
async function getRouteContext(message: string, userLocation: Coordinates | null): Promise<string> {
  const lowerMessage = message.toLowerCase();
  let additionalContext = "";

  // Check if user is asking about nearest stop
  if (
    lowerMessage.includes("nearest") ||
    lowerMessage.includes("closest") ||
    lowerMessage.includes("near me") ||
    lowerMessage.includes("nearby")
  ) {
    if (userLocation) {
      const stops = await getAllStops();
      const nearest = findNearestStop(userLocation, stops);
      if (nearest) {
        additionalContext = `\n\n[SYSTEM DATA: The nearest stop to the user is ${nearest.stop.properties.stopName}, which is ${formatDistance(nearest.distance)} away. Routes serving this stop: ${nearest.stop.properties.routeIds.map(id => id.replace("route-", "Route ")).join(", ")}]`;
      }
    } else {
      additionalContext = `\n\n[SYSTEM DATA: User's location is not available. Ask them to enable location services or specify their starting point.]`;
    }
  }

  // Check if user is asking about routes to a destination
  const routesToPattern = /(?:what|which)\s+routes?\s+(?:go(?:es)?|serve[sd]?|stop[s]?)\s+(?:to|at)\s+(.+)/i;
  const routesToMatch = message.match(routesToPattern);
  if (routesToMatch) {
    const destination = routesToMatch[1].trim().replace(/[?!.,]+$/, '');
    const stop = await findStopByName(destination);
    if (stop) {
      additionalContext = `\n\n[SYSTEM DATA: Found stop "${stop.properties.stopName}" which is served by: ${stop.properties.routeIds.map(id => id.replace("route-", "Route ")).join(", ")}]`;
    } else {
      additionalContext = `\n\n[SYSTEM DATA: Could not find a stop matching "${destination}". Suggest checking the stop name or listing all available stops.]`;
    }
    return additionalContext;
  }

  // Check if user is asking about stops on a route
  const stopsOnRoutePattern = /(?:what\s+(?:are\s+)?(?:the\s+)?)?(?:stops?|destinations?)\s+(?:on|for|along)\s+route\s*(\d+)/i;
  const routeStopsPattern = /route\s*(\d+)\s+stops?/i;
  const stopsMatch = message.match(stopsOnRoutePattern) || message.match(routeStopsPattern);
  if (stopsMatch) {
    const routeNumber = stopsMatch[1];
    const stops = await getStopsForRoute(routeNumber);
    if (stops.length > 0) {
      additionalContext = `\n\n[SYSTEM DATA: Route ${routeNumber} has ${stops.length} stops: ${stops.map(s => s.properties.stopName).join(", ")}]`;
    } else {
      additionalContext = `\n\n[SYSTEM DATA: Could not find Route ${routeNumber}. Available routes are Route 1 and Route 2.]`;
    }
    return additionalContext;
  }

  // Check if user is asking about route info
  const routeInfoPattern = /(?:tell\s+me\s+)?about\s+route\s*(\d+)|route\s*(\d+)\s+(?:info|information|details)/i;
  const routeInfoMatch = message.match(routeInfoPattern);
  if (routeInfoMatch) {
    const routeNumber = routeInfoMatch[1] || routeInfoMatch[2];
    const route = await getRouteByNumber(routeNumber);
    if (route) {
      const stops = await getStopsForRoute(routeNumber);
      additionalContext = `\n\n[SYSTEM DATA: Route ${routeNumber} info - Name: ${route.properties.routeName}, Stops: ${stops.length}, Description: ${route.properties.description || "N/A"}, Stop list: ${stops.map(s => s.properties.stopName).join(", ")}]`;
    } else {
      additionalContext = `\n\n[SYSTEM DATA: Could not find Route ${routeNumber}. Available routes are Route 1 and Route 2.]`;
    }
    return additionalContext;
  }

  // Check if user is asking how to get to a destination (destination only)
  const getToPattern = /how\s+(?:do\s+I\s+|to\s+|can\s+I\s+)?(?:get|go|travel|commute)\s+to\s+(.+)/i;
  const getToMatch = message.match(getToPattern);
  if (getToMatch) {
    const destination = getToMatch[1].trim().replace(/[?!.,]+$/, '');
    const toStop = await findStopByName(destination);

    if (!toStop) {
      additionalContext = `\n\n[SYSTEM DATA: Could not find a stop matching "${destination}". Suggest checking the stop name or listing all available stops.]`;
      return additionalContext;
    }

    if (!userLocation) {
      additionalContext = `\n\n[SYSTEM DATA: Found destination stop "${toStop.properties.stopName}", but user's location is not available. Ask them to enable location services or specify their starting point.]`;
      return additionalContext;
    }

    // Find nearest stop to user's location
    const stops = await getAllStops();
    const nearest = findNearestStop(userLocation, stops);

    if (nearest) {
      const routeData = await loadRouteData();
      const results = findAllRoutes(
        {
          origin: {
            lat: nearest.stop.geometry.coordinates[1],
            lng: nearest.stop.geometry.coordinates[0],
          },
          destination: {
            lat: toStop.geometry.coordinates[1],
            lng: toStop.geometry.coordinates[0],
          },
        },
        routeData,
        3
      );

      if (results.length > 0) {
        const timeCtx = getTimeContext();
        const comparison = formatRouteComparison(results);
        const walkingNote = formatWalkingTransferNote(results[0]);
        const directions = getRouteDirections(results[0]);

        additionalContext = `\n\n[SYSTEM DATA: Route options from user's nearest stop (${nearest.stop.properties.stopName}, ${formatDistance(nearest.distance)} away) to ${toStop.properties.stopName}:

${timeCtx.message}

${comparison}

Recommended route directions:
${directions.map((d, i) => `  ${i + 1}. ${d}`).join("\n")}
${walkingNote ? `\n${walkingNote}` : ""}]`;
      } else {
        additionalContext = `\n\n[SYSTEM DATA: User's nearest stop is ${nearest.stop.properties.stopName} (${formatDistance(nearest.distance)} away), destination is ${toStop.properties.stopName}, but no route was found between them.]`;
      }
    }
    return additionalContext;
  }

  // Check if user is asking for a route from X to Y
  const fromTo = extractFromTo(message);
  if (fromTo) {
    const fromStop = await findStopByName(fromTo.from);
    const toStop = await findStopByName(fromTo.to);

    if (fromStop && toStop) {
      const routeData = await loadRouteData();
      const results = findAllRoutes(
        {
          origin: {
            lat: fromStop.geometry.coordinates[1],
            lng: fromStop.geometry.coordinates[0],
          },
          destination: {
            lat: toStop.geometry.coordinates[1],
            lng: toStop.geometry.coordinates[0],
          },
        },
        routeData,
        3
      );

      if (results.length > 0) {
        const timeCtx = getTimeContext();
        const comparison = formatRouteComparison(results);
        const walkingNote = formatWalkingTransferNote(results[0]);
        const directions = getRouteDirections(results[0]);

        additionalContext = `\n\n[SYSTEM DATA: Route options from ${fromStop.properties.stopName} to ${toStop.properties.stopName}:

${timeCtx.message}

${comparison}

Recommended route directions:
${directions.map((d, i) => `  ${i + 1}. ${d}`).join("\n")}
${walkingNote ? `\n${walkingNote}` : ""}]`;
      } else {
        additionalContext = `\n\n[SYSTEM DATA: No route found between "${fromTo.from}" and "${fromTo.to}". The stops may not be connected or one of the names wasn't recognized.]`;
      }
    } else {
      if (!fromStop) {
        additionalContext = `\n\n[SYSTEM DATA: Could not find a stop matching "${fromTo.from}". Suggest the user check the stop name or list available stops.]`;
      } else if (!toStop) {
        additionalContext = `\n\n[SYSTEM DATA: Could not find a stop matching "${fromTo.to}". Suggest the user check the stop name or list available stops.]`;
      }
    }
  }

  // If no pattern matched yet, try flexible destination extraction
  if (!additionalContext) {
    const destination = extractDestination(message);
    if (destination) {
      const toStop = await findStopByName(destination);

      if (toStop) {
        if (!userLocation) {
          additionalContext = `\n\n[SYSTEM DATA: User is asking about routes to ${toStop.properties.stopName}. User location not available - suggest specifying starting point or enabling location services.]`;
        } else {
          // Find route from user's location
          const stops = await getAllStops();
          const nearest = findNearestStop(userLocation, stops);

          if (nearest) {
            const routeData = await loadRouteData();
            const results = findAllRoutes(
              {
                origin: {
                  lat: nearest.stop.geometry.coordinates[1],
                  lng: nearest.stop.geometry.coordinates[0],
                },
                destination: {
                  lat: toStop.geometry.coordinates[1],
                  lng: toStop.geometry.coordinates[0],
                },
              },
              routeData,
              3
            );

            if (results.length > 0) {
              const timeCtx = getTimeContext();
              const comparison = formatRouteComparison(results);
              const walkingNote = formatWalkingTransferNote(results[0]);
              const directions = getRouteDirections(results[0]);

              additionalContext = `\n\n[SYSTEM DATA: Route options from user's nearest stop (${nearest.stop.properties.stopName}, ${formatDistance(nearest.distance)} away) to ${toStop.properties.stopName}:

${timeCtx.message}

${comparison}

Recommended route directions:
${directions.map((d, i) => `  ${i + 1}. ${d}`).join("\n")}
${walkingNote ? `\n${walkingNote}` : ""}]`;
            } else {
              additionalContext = `\n\n[SYSTEM DATA: User's nearest stop is ${nearest.stop.properties.stopName}, destination is ${toStop.properties.stopName}, but no route was found between them.]`;
            }
          }
        }
      } else {
        additionalContext = `\n\n[SYSTEM DATA: User mentioned "${destination}" but no matching stop was found. Suggest checking the stop name or listing all available stops.]`;
      }
    }
  }

  return additionalContext;
}

// Main response function - async for Gemini API
export async function getChatbotResponse(
  message: string,
  userLocation: Coordinates | null
): Promise<string> {
  try {
    // Check if API key is available
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      return await getFallbackResponse(message, userLocation);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Build the context and get route data
    const systemContext = await buildSystemContext(userLocation);
    const routeContext = await getRouteContext(message, userLocation);

    // Create the prompt
    const prompt = `${systemContext}${routeContext}

User message: ${message}

Please provide a helpful response based on the DC Bus route information above.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return text || "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Gemini API error:", error);
    // Fallback to basic response on error
    return await getFallbackResponse(message, userLocation);
  }
}

// Fallback response function (keyword-based)
async function getFallbackResponse(
  message: string,
  userLocation: Coordinates | null
): Promise<string> {
  const lowerMessage = message.toLowerCase().trim();

  // Greetings
  if (
    lowerMessage.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)
  ) {
    let greeting = "Hello! I'm here to help you navigate the DC Bus routes in Davao City. You can ask me about:\n\n• Nearest bus stops\n• How to get from one place to another\n• List of all bus stops\n• Information about specific stops";

    // Add nearby stops if user location is available
    if (userLocation) {
      const stops = await getAllStops();
      const nearbyInfo = formatNearbyStops(userLocation, stops);
      if (nearbyInfo) {
        greeting += `\n\n${nearbyInfo}`;
      }
    }

    greeting += "\n\nHow can I assist you today?";
    return greeting;
  }

  // Thanks
  if (lowerMessage.match(/^(thanks|thank you|salamat)/)) {
    clearContext();
    return "You're welcome! If you have any other questions about DC Bus routes, feel free to ask. Safe travels!";
  }

  // Handle "yes" follow-up responses
  if (lowerMessage.match(/^(yes|yeah|yep|sure|ok|okay|please|go ahead|yea|yup)$/i)) {
    if (lastMentionedStop && lastAction === "directions") {
      const toStop = lastMentionedStop;
      clearContext();

      if (!userLocation) {
        return `To give you directions to **${toStop.properties.stopName}**, I need your location. Please enable location services, or tell me where you're coming from (e.g., "from Toril to ${toStop.properties.stopName}").`;
      }

      // Find nearest stop to user's location and calculate route
      const stops = await getAllStops();
      const nearest = findNearestStop(userLocation, stops);

      if (!nearest) {
        return `I found ${toStop.properties.stopName}, but couldn't determine your nearest stop. Please specify your starting point.`;
      }

      const routeData = await loadRouteData();
      const results = findAllRoutes(
        {
          origin: {
            lat: nearest.stop.geometry.coordinates[1],
            lng: nearest.stop.geometry.coordinates[0],
          },
          destination: {
            lat: toStop.geometry.coordinates[1],
            lng: toStop.geometry.coordinates[0],
          },
        },
        routeData,
        3
      );

      if (results.length === 0) {
        return `I found your nearest stop (${nearest.stop.properties.stopName}) and destination (${toStop.properties.stopName}), but couldn't find a route between them.`;
      }

      const timeCtx = getTimeContext();
      const comparison = formatRouteComparison(results);
      const walkingNote = formatWalkingTransferNote(results[0]);
      const directions = getRouteDirections(results[0]);

      let response = `**Route to ${toStop.properties.stopName}**\n\n${timeCtx.message}\n\nYour nearest stop: ${nearest.stop.properties.stopName} (${formatDistance(nearest.distance)} away)\n\n**Route Options:**\n${comparison}\n\n**Recommended Route Directions:**\n${directions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;

      if (walkingNote) {
        response += `\n\n${walkingNote}`;
      }

      return response;
    }

    // No context - give help
    clearContext();
    return "I'm not sure what you're saying yes to. Could you please ask a specific question like:\n\n• \"How do I get to SM Ecoland?\"\n• \"What routes go to Bankerohan?\"\n• \"List all stops\"";
  }

  // What routes go to/serve [destination]?
  const routesToPattern = /(?:what|which)\s+routes?\s+(?:go(?:es)?|serve[sd]?|stop[s]?)\s+(?:to|at)\s+(.+)/i;
  const routesToMatch = message.match(routesToPattern);
  if (routesToMatch) {
    const destination = routesToMatch[1].trim().replace(/[?!.,]+$/, '');
    const stop = await findStopByName(destination);
    if (stop) {
      // Set context for follow-up "yes" response
      setContext(stop, "directions");
      return `**${stop.properties.stopName}** is served by the following routes:\n\n${stop.properties.routeIds
        .map((id) => `• ${id}`)
        .join("\n")}\n\nWould you like directions to this stop?`;
    } else {
      clearContext();
      return `I couldn't find a stop matching "${destination}". Please check the stop name or ask me to "list all stops" to see available options.`;
    }
  }

  // What stops are on Route X? / Route X stops
  const stopsOnRoutePattern = /(?:what\s+(?:are\s+)?(?:the\s+)?)?(?:stops?|destinations?)\s+(?:on|for|along)\s+route\s*(\d+)/i;
  const routeStopsPattern = /route\s*(\d+)\s+stops?/i;
  const stopsMatch = message.match(stopsOnRoutePattern) || message.match(routeStopsPattern);
  if (stopsMatch) {
    const routeNumber = stopsMatch[1];
    const stops = await getStopsForRoute(routeNumber);
    if (stops.length > 0) {
      const stopList = stops
        .map((s, i) => `${i + 1}. ${s.properties.stopName}`)
        .join("\n");
      return `**Route ${routeNumber} Stops:**\n\n${stopList}\n\nTotal: ${stops.length} stops`;
    } else {
      return `I couldn't find Route ${routeNumber}. Available routes are Route 1 and Route 2.`;
    }
  }

  // Tell me about Route X / Route X info
  const routeInfoPattern = /(?:tell\s+me\s+)?about\s+route\s*(\d+)|route\s*(\d+)\s+(?:info|information|details)/i;
  const routeInfoMatch = message.match(routeInfoPattern);
  if (routeInfoMatch) {
    const routeNumber = routeInfoMatch[1] || routeInfoMatch[2];
    const route = await getRouteByNumber(routeNumber);
    if (route) {
      const stops = await getStopsForRoute(routeNumber);
      const firstStop = stops[0]?.properties.stopName || "Unknown";
      const lastStop = stops[stops.length - 1]?.properties.stopName || "Unknown";
      return `**Route ${routeNumber} Information:**\n\n• Name: ${route.properties.routeName}\n• From: ${firstStop}\n• To: ${lastStop}\n• Total Stops: ${stops.length}\n${route.properties.description ? `• Description: ${route.properties.description}` : ""}\n\n_Try: "route ${routeNumber} stops" to see all stops on this route._`;
    } else {
      return `I couldn't find Route ${routeNumber}. Available routes are Route 1 and Route 2.`;
    }
  }

  // How do I get to [destination]? (destination only, use user location)
  const getToPattern = /how\s+(?:do\s+I\s+|to\s+|can\s+I\s+)?(?:get|go|travel|commute)\s+to\s+(.+)/i;
  const getToMatch = message.match(getToPattern);
  if (getToMatch) {
    const destination = getToMatch[1].trim().replace(/[?!.,]+$/, '');
    const toStop = await findStopByName(destination);

    if (!toStop) {
      return `I couldn't find a stop matching "${destination}". Please check the stop name or ask me to "list all stops" to see available options.`;
    }

    if (!userLocation) {
      return `To give you directions to **${toStop.properties.stopName}**, I need your location. Please enable location services, or tell me where you're coming from (e.g., "from SM Lanang to ${toStop.properties.stopName}").`;
    }

    // Find nearest stop to user's location
    const stops = await getAllStops();
    const nearest = findNearestStop(userLocation, stops);

    if (!nearest) {
      return `I found ${toStop.properties.stopName}, but couldn't determine your nearest stop. Please specify your starting point.`;
    }

    const routeData = await loadRouteData();
    const results = findAllRoutes(
      {
        origin: {
          lat: nearest.stop.geometry.coordinates[1],
          lng: nearest.stop.geometry.coordinates[0],
        },
        destination: {
          lat: toStop.geometry.coordinates[1],
          lng: toStop.geometry.coordinates[0],
        },
      },
      routeData,
      3
    );

    if (results.length === 0) {
      return `I found your nearest stop (${nearest.stop.properties.stopName}) and destination (${toStop.properties.stopName}), but couldn't find a route between them.`;
    }

    const timeCtx = getTimeContext();
    const comparison = formatRouteComparison(results);
    const walkingNote = formatWalkingTransferNote(results[0]);
    const directions = getRouteDirections(results[0]);

    let response = `**Route from your location to ${toStop.properties.stopName}**\n\n${timeCtx.message}\n\nYour nearest stop: ${nearest.stop.properties.stopName} (${formatDistance(nearest.distance)} away)\n\n**Route Options:**\n${comparison}\n\n**Recommended Route Directions:**\n${directions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;

    if (walkingNote) {
      response += `\n\n${walkingNote}`;
    }

    return response;
  }

  // "More stops" / "All stops near me" - show ALL within 2km
  // Note: "more stops" works alone, but "all/every stops" requires "near/nearby"
  if (
    lowerMessage.match(/more\s+stops?/) ||
    lowerMessage.match(/(?:all|every)\s+stops?\s+(?:near|nearby)/) ||
    lowerMessage.match(/show\s+more/)
  ) {
    if (!userLocation) {
      return "I need your location to find nearby stops. Please enable location services in your browser and try again.";
    }

    const stops = await getAllStops();
    const allNearby = findStopsWithinRadius(userLocation, stops, 2); // 2km radius

    if (allNearby.length === 0) {
      return "Sorry, I couldn't find any stops within 2km of your location.";
    }

    let response = `**All stops near you (${allNearby.length} stops within 2km):**\n\n`;
    allNearby.forEach((s, i) => {
      const routes = [...new Set(s.stop.properties.routeIds.map(id => id.split("-")[0]))].join(", ");
      response += `${i + 1}. ${s.stop.properties.stopName} (${formatDistance(s.distance)})\n   Routes: ${routes}\n\n`;
    });

    return response;
  }

  // Nearest/nearby stops - show 5 closest
  if (
    lowerMessage.includes("nearest") ||
    lowerMessage.includes("closest") ||
    lowerMessage.includes("near me") ||
    lowerMessage.includes("nearby") ||
    lowerMessage.match(/stops?\s+near/)
  ) {
    if (!userLocation) {
      return "I need your location to find the nearest stop. Please enable location services in your browser and try again.";
    }

    const stops = await getAllStops();
    const allNearby = findStopsWithinRadius(userLocation, stops, 2); // 2km radius

    if (allNearby.length === 0) {
      return "Sorry, I couldn't find any stops near you.";
    }

    const stopsToShow = allNearby.slice(0, 5); // First 5

    let response = `**Stops near you:**\n\n`;
    stopsToShow.forEach((s, i) => {
      const routes = [...new Set(s.stop.properties.routeIds.map(id => id.split("-")[0]))].join(", ");
      response += `${i + 1}. ${s.stop.properties.stopName} (${formatDistance(s.distance)})\n   Routes: ${routes}\n\n`;
    });

    if (allNearby.length > 5) {
      response += `_Showing 5 of ${allNearby.length} nearby stops. Say "more stops" to see all._`;
    }

    return response;
  }

  // Stops in specific area - "stops in Toril", "list stops in Mintal"
  const stopsInAreaMatch = lowerMessage.match(/(?:stops?|list\s+stops?)\s+(?:in|at|around)\s+(\w+)/i);
  if (stopsInAreaMatch) {
    const areaQuery = stopsInAreaMatch[1].toLowerCase();
    const routeData = await loadRouteData();
    const validAreas = ["toril", "mintal", "bangkal", "buhangin", "panacan"];

    // Find matching area (case-insensitive)
    const matchedArea = validAreas.find(a => a.includes(areaQuery) || areaQuery.includes(a));

    if (!matchedArea) {
      return `I don't recognize "${stopsInAreaMatch[1]}" as an area. Available areas are: **Toril**, **Mintal**, **Bangkal**, **Buhangin**, **Panacan**.\n\nTry: "stops in Toril" or "list all stops" to see all grouped by area.`;
    }

    // Find all stops in this area
    const stopsInArea: { stop: GeoJSONStop; routes: string[] }[] = [];
    for (const [stopId, stop] of routeData.stops) {
      const areas = routeData.stopAreas.get(stopId);
      if (areas && Array.from(areas).some(a => a.toLowerCase() === matchedArea)) {
        const routes = [...new Set(stop.properties.routeIds.map(id => id.split("-")[0]))];
        stopsInArea.push({ stop, routes });
      }
    }

    if (stopsInArea.length === 0) {
      return `No stops found in ${matchedArea.charAt(0).toUpperCase() + matchedArea.slice(1)}.`;
    }

    const areaName = matchedArea.charAt(0).toUpperCase() + matchedArea.slice(1);
    let response = `**Stops in ${areaName} (${stopsInArea.length} stops):**\n\n`;
    stopsInArea.forEach((s, i) => {
      response += `${i + 1}. ${s.stop.properties.stopName}\n   Routes: ${s.routes.join(", ")}\n\n`;
    });

    return response;
  }

  // List all stops - grouped by area
  if (
    lowerMessage.includes("all stops") ||
    lowerMessage.includes("list stops") ||
    lowerMessage.includes("show stops") ||
    lowerMessage.includes("what stops") ||
    lowerMessage.includes("available stops")
  ) {
    const routeData = await loadRouteData();

    // Group stops by area
    const stopsByArea = new Map<string, GeoJSONStop[]>();
    for (const [stopId, stop] of routeData.stops) {
      const areas = routeData.stopAreas.get(stopId) || new Set();
      for (const area of areas) {
        if (!stopsByArea.has(area)) {
          stopsByArea.set(area, []);
        }
        // Avoid duplicates
        if (!stopsByArea.get(area)!.some(s => s.properties.stopId === stopId)) {
          stopsByArea.get(area)!.push(stop);
        }
      }
    }

    // Sort areas alphabetically
    const sortedAreas = Array.from(stopsByArea.keys()).sort();

    let response = `**DC Bus Stops by Area:**\n\n`;
    let totalStops = 0;

    for (const area of sortedAreas) {
      const stops = stopsByArea.get(area)!;
      totalStops += stops.length;
      const stopNames = stops.slice(0, 5).map(s => s.properties.stopName).join(", ");
      const moreText = stops.length > 5 ? `, +${stops.length - 5} more` : "";

      response += `📍 **${area}** (${stops.length} stops)\n`;
      response += `   ${stopNames}${moreText}\n\n`;
    }

    response += `**Total:** ${routeData.stops.size} stops across ${sortedAreas.length} areas\n\n`;
    response += `_Say "stops in [area]" for full list (e.g., "stops in Toril")_`;

    return response;
  }

  // Route finding (from X to Y)
  const fromTo = extractFromTo(message);
  if (fromTo) {
    const fromStop = await findStopByName(fromTo.from);
    const toStop = await findStopByName(fromTo.to);

    if (!fromStop) {
      return `I couldn't find a stop matching "${fromTo.from}". Please try a different location name.`;
    }

    if (!toStop) {
      return `I couldn't find a stop matching "${fromTo.to}". Please try a different location name.`;
    }

    const routeData = await loadRouteData();
    const results = findAllRoutes(
      {
        origin: {
          lat: fromStop.geometry.coordinates[1],
          lng: fromStop.geometry.coordinates[0],
        },
        destination: {
          lat: toStop.geometry.coordinates[1],
          lng: toStop.geometry.coordinates[0],
        },
      },
      routeData,
      3
    );

    if (results.length === 0) {
      return `Sorry, I couldn't find a route from ${fromStop.properties.stopName} to ${toStop.properties.stopName}.`;
    }

    const timeCtx = getTimeContext();
    const comparison = formatRouteComparison(results);
    const walkingNote = formatWalkingTransferNote(results[0]);
    const directions = getRouteDirections(results[0]);

    let response = `**Route from ${fromStop.properties.stopName} to ${toStop.properties.stopName}**\n\n${timeCtx.message}\n\n**Route Options:**\n${comparison}\n\n**Recommended Route Directions:**\n${directions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;

    if (walkingNote) {
      response += `\n\n${walkingNote}`;
    }

    return response;
  }

  // Try flexible destination extraction for natural language queries
  const destination = extractDestination(message);
  if (destination) {
    const toStop = await findStopByName(destination);

    if (toStop) {
      if (!userLocation) {
        return `I found **${toStop.properties.stopName}**! To give you route directions, I need to know your starting point.\n\nPlease either:\n• Enable location services\n• Tell me where you're coming from (e.g., "from Toril to ${toStop.properties.stopName}")`;
      }

      // Find nearest stop to user's location and calculate route
      const stops = await getAllStops();
      const nearest = findNearestStop(userLocation, stops);

      if (!nearest) {
        return `I found ${toStop.properties.stopName}, but couldn't determine your nearest stop. Please specify your starting point.`;
      }

      const routeData = await loadRouteData();
      const results = findAllRoutes(
        {
          origin: {
            lat: nearest.stop.geometry.coordinates[1],
            lng: nearest.stop.geometry.coordinates[0],
          },
          destination: {
            lat: toStop.geometry.coordinates[1],
            lng: toStop.geometry.coordinates[0],
          },
        },
        routeData,
        3
      );

      if (results.length === 0) {
        return `I found your nearest stop (${nearest.stop.properties.stopName}) and destination (${toStop.properties.stopName}), but couldn't find a route between them.`;
      }

      const timeCtx = getTimeContext();
      const comparison = formatRouteComparison(results);
      const walkingNote = formatWalkingTransferNote(results[0]);
      const directions = getRouteDirections(results[0]);

      let response = `**Route to ${toStop.properties.stopName}**\n\n${timeCtx.message}\n\nYour nearest stop: ${nearest.stop.properties.stopName} (${formatDistance(nearest.distance)} away)\n\n**Route Options:**\n${comparison}\n\n**Recommended Route Directions:**\n${directions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;

      if (walkingNote) {
        response += `\n\n${walkingNote}`;
      }

      return response;
    } else {
      // Destination mentioned but not found
      return `I couldn't find a stop matching "${destination}".\n\nTry:\n• "list all stops" to see available stops\n• Check if the spelling is correct`;
    }
  }

  // Default response
  return `I can help you with DC Bus routes and stops in Davao City. Here's what you can ask me:\n\n• "What is the nearest stop?" - Find stops near you\n• "How do I get from SM Lanang to SM Ecoland?" - Get route directions\n• "List all stops" - See all available stops\n• "Tell me about Bankerohan" - Get info about a specific stop\n\nTry asking one of these questions!`;
}
