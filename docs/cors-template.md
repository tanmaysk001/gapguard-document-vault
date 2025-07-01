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

  const commonHeaders = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, user-agent",
    "Access-Control-Max-Age": "86400", // 24 hours
    "Vary": "Origin"
  };

  // Secure origin handling - never use wildcard in production
  if (origin && allowedOrigins.includes(origin)) {
    return {
      ...commonHeaders,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true"
    };
  }
  
  // Fallback to production origin if set, otherwise localhost for development
  const fallbackOrigin = productionOrigin || "http://localhost:3000";
     return {
     ...commonHeaders,
     "Access-Control-Allow-Origin": fallbackOrigin,
     "Access-Control-Allow-Credentials": "false"
   };
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

1. **Secure origin validation** - Only allows explicitly whitelisted origins
2. **NO wildcard (*) usage** - Prevents security vulnerabilities in production
3. **Handles preflight requests** - Browsers send OPTIONS requests first
4. **Environment-specific configuration** - Uses PRODUCTION_CORS_ORIGIN for production
5. **Credential handling** - Enables credentials only for trusted origins
6. **Always includes CORS headers** - Both success and error responses

## Security Features

- ✅ **No wildcard origins** - Prevents CORS-based attacks
- ✅ **Explicit allowlist** - Only trusted domains are allowed
- ✅ **Environment awareness** - Different behavior for dev vs production
- ✅ **Secure fallback** - Defaults to production origin or localhost
- ✅ **Credential protection** - Only enables credentials for whitelisted origins

## Why CORS Happens

- Your frontend (localhost:8080) and backend (supabase.co) are different domains
- Browsers block cross-origin requests by default for security
- CORS headers tell the browser "this is allowed"
- Edge Functions need to explicitly set these headers

Just copy-paste this template into any new Edge Function and you'll never have CORS issues again! 