/**
 * Import script to upload all route JSON files to Supabase
 *
 * Run with: npm run import-routes
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use service role key for imports (bypasses RLS)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("Make sure .env.local exists with your Supabase credentials");
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Warning: Using anon key. Add SUPABASE_SERVICE_ROLE_KEY to .env.local for full access.\n");
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface RoutePoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  kind: "stop" | "waypoint";
  heading: number;
}

interface RouteFile {
  id: string;
  route_number: string;
  name: string;
  area: string;
  time_period: string;
  color: string;
  start_time: string;
  end_time: string;
  points: RoutePoint[];
}

async function importRoutes() {
  const routesDir = path.join(process.cwd(), "Routes-dcbus");
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith(".json"));

  console.log(`Found ${files.length} route files to import\n`);

  // Track unique stops and route_stops across all routes
  const allStops = new Map<string, { id: string; name: string; lat: number; lng: number }>();
  const allRouteStops: { routeId: string; stopId: string; order: number; heading: number }[] = [];

  // PHASE 1: Insert routes, paths, and collect stops
  console.log("Phase 1: Importing routes and paths...\n");

  for (const file of files) {
    const filePath = path.join(routesDir, file);
    const data: RouteFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const routeId = `${data.route_number}-${data.time_period}`;
    console.log(`Processing ${routeId}...`);

    // 1. Insert route
    const { error: routeError } = await supabase.from("routes").upsert({
      route_id: routeId,
      route_number: data.route_number,
      name: data.name,
      area: data.area,
      time_period: data.time_period,
      color: data.color,
      start_time: data.start_time,
      end_time: data.end_time,
    }, { onConflict: "route_id" });

    if (routeError) {
      console.error(`  Error inserting route: ${routeError.message}`);
      continue;
    }

    // 2. Collect stops and build path coordinates
    const coordinates: [number, number][] = [];
    let stopOrder = 0;

    for (const point of data.points) {
      coordinates.push([point.longitude, point.latitude]);

      if (point.kind === "stop" && point.name) {
        stopOrder++;

        if (!allStops.has(point.id)) {
          allStops.set(point.id, {
            id: point.id,
            name: point.name,
            lat: point.latitude,
            lng: point.longitude,
          });
        }

        allRouteStops.push({
          routeId: routeId,
          stopId: point.id,
          order: stopOrder,
          heading: point.heading,
        });
      }
    }

    // 3. Insert route path
    const { error: pathError } = await supabase.from("route_paths").upsert({
      route_id: routeId,
      coordinates: coordinates,
    }, { onConflict: "route_id" });

    if (pathError) {
      console.error(`  Error inserting path: ${pathError.message}`);
    }

    console.log(`  ✓ ${stopOrder} stops, ${coordinates.length} path points`);
  }

  // PHASE 2: Insert all stops FIRST
  console.log(`\nPhase 2: Inserting ${allStops.size} unique stops...`);

  for (const [stopId, stop] of allStops) {
    const { error: stopError } = await supabase.from("stops").upsert({
      stop_id: stopId,
      stop_name: stop.name,
      latitude: stop.lat,
      longitude: stop.lng,
    }, { onConflict: "stop_id" });

    if (stopError) {
      console.error(`Error inserting stop ${stop.name}: ${stopError.message}`);
    }
  }
  console.log(`  ✓ Stops inserted`);

  // PHASE 3: Insert route_stops relationships AFTER stops exist
  console.log(`\nPhase 3: Inserting ${allRouteStops.length} route-stop relationships...`);

  for (const rs of allRouteStops) {
    const { error: rsError } = await supabase.from("route_stops").upsert({
      route_id: rs.routeId,
      stop_id: rs.stopId,
      stop_order: rs.order,
      heading: rs.heading,
    }, { onConflict: "route_id,stop_id" });

    if (rsError) {
      console.error(`  Error inserting route_stop: ${rsError.message}`);
    }
  }
  console.log(`  ✓ Route-stops inserted`);

  console.log("\n✓ Import complete!");
}

importRoutes().catch(console.error);
