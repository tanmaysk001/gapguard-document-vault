// @ts-ignore: Deno global
// FORCE-REDEPLOY-2024-07-16
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtVerify, createRemoteJWKSet } from "https://deno.land/x/jose@v4.14.4/index.ts";
import { Database } from "../lib/database.types.ts";
import { suggestRules } from "../lib/ai.ts";

// --- Environment Variable Validation ---
const REQUIRED_ENV_VARS = [
  "CLERK_JWKS_URL", 
  "CLERK_ISSUER", 
  "GEMINI_API_KEY", 
  "SUPABASE_URL", 
  "SUPABASE_SERVICE_ROLE_KEY",
  "PRODUCTION_CORS_ORIGIN"
];
for (const v of REQUIRED_ENV_VARS) {
    if (!Deno.env.get(v)) {
        console.error(`Missing required environment variable: ${v}`);
        throw new Error(`Missing required environment variable: ${v}`);
    }
}

// --- Auth Configuration ---
const CLERK_JWKS_URL = Deno.env.get("CLERK_JWKS_URL");
const CLERK_ISSUER = Deno.env.get("CLERK_ISSUER");

if (!CLERK_JWKS_URL || !CLERK_ISSUER) {
  console.error("Missing Clerk configuration:", {
    CLERK_JWKS_URL: CLERK_JWKS_URL ? "SET" : "MISSING",
    CLERK_ISSUER: CLERK_ISSUER ? "SET" : "MISSING"
  });
  throw new Error("Missing Clerk configuration. Please set CLERK_JWKS_URL and CLERK_ISSUER environment variables.");
}

const JWKS = createRemoteJWKSet(new URL(CLERK_JWKS_URL));

// --- DYNAMIC CORS ---
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const productionOrigin = Deno.env.get("PRODUCTION_CORS_ORIGIN")!;
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    productionOrigin
  ];

  const commonHeaders = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };

  if (origin && allowedOrigins.includes(origin)) {
    return { ...commonHeaders, "Access-Control-Allow-Origin": origin };
  }
  
  return { ...commonHeaders, "Access-Control-Allow-Origin": productionOrigin };
}

// --- JWT Verification Helper ---
async function getUserIdFromJwt(req: Request): Promise<string> {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }
    const token = authHeader.replace("Bearer ", "");
    
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: CLERK_ISSUER,
      algorithms: ["RS256"],
    });

    if (!payload.sub) {
      throw new Error("Invalid JWT: No 'sub' claim found");
    }
    return payload.sub;
}


// --- Main Logic ---

async function getDocumentContext(supabase: SupabaseClient<Database>, userId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('documents')
        .select('doc_category')
        .eq('user_id', userId)
        .not('doc_category', 'is', null);

    if (error) {
        console.error("Error fetching document context:", error);
        return [];
    }

    // Return a unique list of non-null categories
    const categories = data.map(d => d.doc_category).filter(Boolean) as string[];
    return [...new Set(categories)];
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await getUserIdFromJwt(req);

    const supabaseAdmin = createClient<Database>(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get context from user's existing documents
    const categories = await getDocumentContext(supabaseAdmin, userId);
    if (categories.length === 0) {
        return new Response(JSON.stringify({ message: "Not enough context to make suggestions." }), { status: 200, headers: corsHeaders });
    }

    // 2. Call AI to get suggestions
    const aiResponse = await suggestRules(categories);
    const suggestions = aiResponse.suggestions || [];

    if (suggestions.length === 0) {
        return new Response(JSON.stringify({ message: "No new suggestions found." }), { status: 200, headers: corsHeaders });
    }

    // 3. Check for existing rules to prevent duplicates
    const { data: existingRules, error: fetchError } = await supabaseAdmin
        .from('document_rules')
        .select('rule_name')
        .eq('user_id', userId);

    if (fetchError) {
        console.error("Error fetching existing rules:", fetchError);
        throw new Error(`Failed to check existing rules: ${fetchError.message}`);
    }

    const existingRuleNames = new Set(
        (existingRules || []).map(rule => rule.rule_name.toLowerCase().trim())
    );

    // Filter out suggestions that already exist (case-insensitive)
    const newSuggestions = suggestions.filter((s: { rule_name: string; reason?: string }) => 
        !existingRuleNames.has(s.rule_name.toLowerCase().trim())
    );

    if (newSuggestions.length === 0) {
        return new Response(JSON.stringify({ message: "All suggested rules already exist." }), { status: 200, headers: corsHeaders });
    }

    // Limit to maximum 5 suggestions to prevent overwhelming the user
    const limitedSuggestions = newSuggestions.slice(0, 5);

    // 4. Prepare suggestions for insertion
    const rulesToInsert = limitedSuggestions.map((s: { rule_name: string; reason?: string }) => ({
        user_id: userId,
        rule_name: s.rule_name,
        description: s.reason ? s.reason : '', // Fallback to empty string if missing
        status: 'suggested' as const,
        required_doc_types: [s.rule_name] // A sensible default
    }));

    // 5. Insert new suggestions into the database
    const { data: newRules, error: insertError } = await supabaseAdmin
        .from('document_rules')
        .insert(rulesToInsert)
        .select();
    
    if (insertError) {
        console.error("Error inserting suggestions:", insertError);
        throw new Error(`Failed to save suggestions: ${insertError.message}`);
    }

    return new Response(JSON.stringify({ 
      message: "Suggestions generated successfully.", 
      suggestions: newRules 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}); 