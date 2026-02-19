import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadRouteData, getRawGeoJSON } from "./data-loader";
import { findRoute, getRouteDirections } from "./route-algorithm";
import { findNearestStop, formatDistance } from "./geo-utils";
import type { GeoJSONStop, GeoJSONRoute, Coordinates } from "./types";

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
  }

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
7. Use emojis sparingly to make responses friendly (bus emoji, location pin, etc.).${locationContext}

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
      const result = findRoute(
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
        routeData
      );

      if (result) {
        const directions = getRouteDirections(result);
        additionalContext = `\n\n[SYSTEM DATA: Route found from user's nearest stop (${nearest.stop.properties.stopName}, ${formatDistance(nearest.distance)} away) to ${toStop.properties.stopName}:
- Type: ${result.type === "transfer" ? "Transfer required" : "Direct route"}
- Total stops: ${result.totalStops}
- Distance: ${formatDistance(result.totalDistanceKm)}
- Directions:
${directions.map((d, i) => `  ${i + 1}. ${d}`).join("\n")}]`;
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
      const result = findRoute(
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
        routeData
      );

      if (result) {
        const directions = getRouteDirections(result);
        additionalContext = `\n\n[SYSTEM DATA: Route found from ${fromStop.properties.stopName} to ${toStop.properties.stopName}:
- Type: ${result.type === "transfer" ? "Transfer required" : "Direct route"}
- Total stops: ${result.totalStops}
- Distance: ${formatDistance(result.totalDistanceKm)}
- Directions:
${directions.map((d, i) => `  ${i + 1}. ${d}`).join("\n")}]`;
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
    return "Hello! I'm here to help you navigate the DC Bus routes in Davao City. You can ask me about:\n\n• Nearest bus stops\n• How to get from one place to another\n• List of all bus stops\n• Information about specific stops\n\nHow can I assist you today?";
  }

  // Thanks
  if (lowerMessage.match(/^(thanks|thank you|salamat)/)) {
    return "You're welcome! If you have any other questions about DC Bus routes, feel free to ask. Safe travels!";
  }

  // What routes go to/serve [destination]?
  const routesToPattern = /(?:what|which)\s+routes?\s+(?:go(?:es)?|serve[sd]?|stop[s]?)\s+(?:to|at)\s+(.+)/i;
  const routesToMatch = message.match(routesToPattern);
  if (routesToMatch) {
    const destination = routesToMatch[1].trim().replace(/[?!.,]+$/, '');
    const stop = await findStopByName(destination);
    if (stop) {
      const routeNames = stop.properties.routeIds
        .map((id) => id.replace("route-", "Route "))
        .join(", ");
      return `**${stop.properties.stopName}** is served by the following routes:\n\n${stop.properties.routeIds
        .map((id) => `• ${id.replace("route-", "Route ")}`)
        .join("\n")}\n\nWould you like directions to this stop or more information about a specific route?`;
    } else {
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
      return `**Route ${routeNumber} Information:**\n\n• Name: ${route.properties.routeName}\n• From: ${firstStop}\n• To: ${lastStop}\n• Total Stops: ${stops.length}\n${route.properties.description ? `• Description: ${route.properties.description}` : ""}\n\nWould you like to see the list of stops on this route?`;
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
    const result = findRoute(
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
      routeData
    );

    if (!result) {
      return `I found your nearest stop (${nearest.stop.properties.stopName}) and destination (${toStop.properties.stopName}), but couldn't find a route between them.`;
    }

    const directions = getRouteDirections(result);
    const routeType = result.type === "transfer" ? "with 1 transfer" : "direct route";

    return `**Route from your location to ${toStop.properties.stopName}**\n\nYour nearest stop: ${nearest.stop.properties.stopName} (${formatDistance(nearest.distance)} away)\n\nThis is a ${routeType} covering ${result.totalStops} stops (${formatDistance(result.totalDistanceKm)}).\n\n**Directions:**\n${directions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;
  }

  // Nearest stop
  if (
    lowerMessage.includes("nearest") ||
    lowerMessage.includes("closest") ||
    lowerMessage.includes("near me") ||
    lowerMessage.includes("nearby")
  ) {
    if (!userLocation) {
      return "I need your location to find the nearest stop. Please enable location services in your browser and try again.";
    }

    const stops = await getAllStops();
    const nearest = findNearestStop(userLocation, stops);

    if (!nearest) {
      return "Sorry, I couldn't find any stops near you.";
    }

    return `The nearest DC Bus stop to your location is:\n\n**${nearest.stop.properties.stopName}**\n${nearest.stop.properties.description || ""}\n\nDistance: ${formatDistance(nearest.distance)}\n\nRoutes: ${nearest.stop.properties.routeIds.map((id) => id.replace("route-", "Route ")).join(", ")}`;
  }

  // List all stops
  if (
    lowerMessage.includes("all stops") ||
    lowerMessage.includes("list stops") ||
    lowerMessage.includes("show stops") ||
    lowerMessage.includes("what stops") ||
    lowerMessage.includes("available stops")
  ) {
    const stops = await getAllStops();
    const sortedStops = [...stops].sort(
      (a, b) => a.properties.order - b.properties.order
    );

    const stopList = sortedStops
      .map((s, i) => `${i + 1}. ${s.properties.stopName}`)
      .join("\n");

    return `Here are all the DC Bus stops:\n\n${stopList}\n\nTotal: ${stops.length} stops`;
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
    const result = findRoute(
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
      routeData
    );

    if (!result) {
      return `Sorry, I couldn't find a route from ${fromStop.properties.stopName} to ${toStop.properties.stopName}.`;
    }

    const directions = getRouteDirections(result);
    const routeType = result.type === "transfer" ? "with 1 transfer" : "direct route";

    return `**Route from ${fromStop.properties.stopName} to ${toStop.properties.stopName}**\n\nThis is a ${routeType} covering ${result.totalStops} stops (${formatDistance(result.totalDistanceKm)}).\n\n**Directions:**\n${directions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;
  }

  // Default response
  return `I can help you with DC Bus routes and stops in Davao City. Here's what you can ask me:\n\n• "What is the nearest stop?" - Find stops near you\n• "How do I get from SM Lanang to SM Ecoland?" - Get route directions\n• "List all stops" - See all available stops\n• "Tell me about Bankerohan" - Get info about a specific stop\n\nTry asking one of these questions!`;
}
