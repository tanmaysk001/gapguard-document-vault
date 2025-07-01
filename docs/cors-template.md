# CORS Template for Supabase Edge Functions

## Quick Copy-Paste CORS Solution

Add this to the top of any Edge Function to prevent CORS issues:

```typescript
// --- COMPREHENSIVE CORS HEADERS ---
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  
  // Allow localhost ports for development
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173", 
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081"
  ];

  // Check if production origin is set and add it
  const productionOrigin = Deno.env.get("PRODUCTION_CORS_ORIGIN");
  if (productionOrigin) {
    allowedOrigins.push(productionOrigin);
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Default to wildcard for development
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, user-agent",
    "Access-Control-Allow-Credentials": "false",
    "Access-Control-Max-Age": "86400", // 24 hours
    "Vary": "Origin"
  };

  // If origin is specified and in allowed list, use it specifically
  if (origin && allowedOrigins.includes(origin)) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }

  return corsHeaders;
}

// In your serve function:
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    // Your function logic here...
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

## What This Does

1. **Allows all localhost ports** - Works with any development server
2. **Handles preflight requests** - Browsers send OPTIONS requests first
3. **Sets all necessary headers** - Complete CORS configuration
4. **Production-ready** - Can set PRODUCTION_CORS_ORIGIN environment variable
5. **Always includes CORS headers** - Both success and error responses

## Why CORS Happens

- Your frontend (localhost:8080) and backend (supabase.co) are different domains
- Browsers block cross-origin requests by default for security
- CORS headers tell the browser "this is allowed"
- Edge Functions need to explicitly set these headers

Just copy-paste this template into any new Edge Function and you'll never have CORS issues again! 