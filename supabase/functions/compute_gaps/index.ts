// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
// @deno-types="https://esm.sh/@supabase/supabase-js@2"
// deno-lint-ignore-file no-explicit-any
// @ts-ignore: Deno global
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), { status: 400 });
    }

    // 1. Load checklist (document_rules) for the user
    const { data: rules, error: rulesError } = await supabase
      .from("document_rules")
      .select("id, required_doc_types")
      .eq("user_id", user_id);
    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ error: "No document rules found for user." }), { status: 404 });
    }
    // For MVP, use the first rule set
    const checklist = rules[0].required_doc_types;
    const checklist_id = rules[0].id;

    // 2. Get latest documents for user, grouped by doc_category
    const { data: docs, error: docsError } = await supabase
      .from("documents")
      .select("id, doc_category, expiry_date, status")
      .eq("user_id", user_id);
    if (docsError) throw docsError;

    // 3. Compute gap status for each required doc type
    const now = new Date();
    const gaps = checklist.map((docType: string) => {
      // Find the most recent valid document of this type, or most recent if none are valid
      // Find the most recent valid document of this type, or most recent if none are valid
      const candidateDocs = docs.filter((d: any) => d.doc_category === docType);
      const doc = candidateDocs.length > 0
        ? candidateDocs.find(d => d.status !== 'processing') || candidateDocs[0]
        : null;
      const doc = candidateDocs.length > 0
        ? candidateDocs.find(d => d.status !== 'processing') || candidateDocs[0]
        : null;      let status = "missing";
      let doc_id = null;
      let days_left = null;
      if (doc) {
        doc_id = doc.id;
        if (doc.expiry_date) {
          const expiry = new Date(doc.expiry_date);
          days_left = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (expiry < now) {
            status = "expired";
          } else if (days_left <= 30) {
            status = "expiring_soon";
          } else {
            status = "valid";
          }
        } else {
          status = doc.status || "valid";
        }
      }
      return {
        user_id,
        checklist_id,
        required_doc_type: docType,
        status,
        doc_id,
        days_left,
        created_at: new Date().toISOString(),
      };
    });

    // 4. Upsert into gaps table (by user_id + required_doc_type)
    for (const gap of gaps) {
      await supabase.from("gaps").upsert({
        user_id: gap.user_id,
        checklist_id: gap.checklist_id,
        required_doc_type: gap.required_doc_type,
        status: gap.status,
        doc_id: gap.doc_id,
        days_left: gap.days_left,
        created_at: gap.created_at,
      }, { onConflict: ["user_id", "required_doc_type"] });
    }

    // 5. Return summary
    return new Response(JSON.stringify({ status: "ok", gaps }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}); 