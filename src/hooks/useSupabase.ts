import { useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

// This hook creates a Supabase client that automatically refreshes the
// Clerk token for every request. This is the modern and correct way to
// handle short-lived JWTs with Supabase.
export const useSupabase = () => {
  const { getToken } = useAuth();

  // Memoize the client so it's not recreated on every render.
  const supabase = useMemo(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Supabase URL or Anon Key is missing from environment variables.");
        return null;
    }
    
    // The key is to provide a custom `fetch` implementation.
    // This function will be called for every request made by the client.
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: {
          fetch: async (input, init) => {
            // Get a fresh token before every request.
            const token = await getToken({ template: 'supabase' });

            // Add the token to the Authorization header.
            const headers = new Headers(init?.headers);
            headers.set('Authorization', `Bearer ${token}`);

            // Proceed with the original fetch request.
            return fetch(input, { ...init, headers });
          },
        },
      });
  }, []);

  return supabase;
}; 