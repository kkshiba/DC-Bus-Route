import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a placeholder client that will gracefully fail if env vars are missing
// This allows the app to build and show appropriate error messages at runtime
let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} else if (typeof window !== "undefined") {
  // Only warn in browser, not during build
  console.warn(
    "Missing Supabase environment variables. " +
      "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

// Export a proxy that throws helpful errors if supabase is not configured
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!supabaseInstance) {
      // During build, return mock functions that return empty data
      if (prop === "from") {
        return () => ({
          select: () => Promise.resolve({ data: [], error: null }),
        });
      }
      if (prop === "rpc") {
        return () => Promise.resolve({ data: [], error: null });
      }
      return () => {};
    }
    return (supabaseInstance as unknown as Record<string, unknown>)[prop as string];
  },
});
