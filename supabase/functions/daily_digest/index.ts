// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
// @deno-types="https://esm.sh/@supabase/supabase-js@2"
// deno-lint-ignore-file no-explicit-any
// @ts-ignore: Deno global
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Validate environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
  console.error("Missing required environment variables.");
  throw new Error("Missing required environment variables. Check function logs.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * A simple utility to escape HTML characters and prevent XSS.
 */
function escapeHtml(unsafe: string | number | null | undefined) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

async function sendEmail(to: string, subject: string, html: string) {
  console.log(`Sending email to: ${to}`);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "GapGuard <noreply@yourdomain.com>", // TODO: Replace with your domain
      to,
      subject,
      html
    })
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: "Unknown error fetching Resend response" }));
    console.error(`Failed to send email: ${res.status} ${res.statusText}`, errorBody);
    throw new Error(`Failed to send email. Status: ${res.status}.`);
  }
  
  console.log(`Email sent successfully to: ${to}`);
  return true;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    // 1. Get all users with non-valid gaps
    const { data: gaps, error: gapsError } = await supabase
      .from("gaps")
      .select("user_id, required_doc_type, status, days_left")
      .neq("status", "valid");
      
    if (gapsError) throw gapsError;

    if (!gaps || gaps.length === 0) {
      return new Response(JSON.stringify({ status: "ok", message: "No gaps found." }), { status: 200 });
    }

    // 2. Group gaps by user_id
    const userGaps: Record<string, any[]> = {};
    for (const gap of gaps) {
      // Ensure user_id is not null before processing
      if (gap.user_id) {
        if (!userGaps[gap.user_id]) {
            userGaps[gap.user_id] = [];
        }
        userGaps[gap.user_id].push(gap);
      }
    }

    // 3. For each user, fetch email and send digest
    const results = [];
    for (const userId of Object.keys(userGaps)) {
        try {
            // Fetch email from auth.users, which is the correct table for user authentication data.
            const { data: user, error: userError } = await supabase
                .from('auth.users') // Corrected table reference
                .select('email')
                .eq('id', userId)
                .single();

            if (userError || !user || !user.email) {
                console.error(`User email not found or error fetching for ID: ${userId}`, userError);
                results.push({ user_id: userId, sent: false, error: "User email not found or missing." });
                continue;
            }
            const email = user.email;
            
            // Format digest, sanitizing content from the database
            const gapList = userGaps[userId].map(g =>
                `<li><b>${escapeHtml(g.required_doc_type)}</b>: <span style='color:red'>${escapeHtml(g.status)}</span>${g.days_left !== null ? ` (${escapeHtml(g.days_left)} days left)` : ""}</li>`
            ).join("");

            const html = `<h2>Your Daily GapGuard Digest</h2><p>Here are your current compliance gaps:</p><ul>${gapList}</ul><p>Please log in to GapGuard to resolve them.</p>`;
            
            // Send email
            await sendEmail(email, "GapGuard: Compliance Gaps Detected", html);
            results.push({ user_id: userId, email, sent: true });

        } catch (emailError) {
            console.error(`Failed to process or send email for user ${userId}:`, emailError);
            results.push({ user_id: userId, sent: false, error: emailError.message });
        }
    }
    return new Response(JSON.stringify({ status: "ok", results }), { status: 200 });
  } catch (e) {
    console.error("Critical error in daily_digest function:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}); 