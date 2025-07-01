import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://deno.land/std@0.168.0/uuid/mod.ts";
import * as fs from "https://deno.land/std@0.168.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.168.0/path/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const USER_ID_FOR_TESTING = "test-user-123"; // A dummy user ID for the test

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars.");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTest(filePath: string) {
  console.log(`--- Starting test for: ${filePath} ---`);

  const docId = uuidv4();
  const fileName = path.basename(filePath);
  const storagePath = `${USER_ID_FOR_TESTING}/${fileName}`;

  try {
    const fileContent = await Deno.readFile(filePath);

    // 1. Create a corresponding 'documents' row
    const { error: insertError } = await supabase.from("documents").insert({
      id: docId,
      user_id: USER_ID_FOR_TESTING,
      file_name: fileName,
      file_url: "placeholder", // The function will be triggered by storage upload
    });
    if (insertError) throw new Error(`Failed to insert document row: ${insertError.message}`);
    console.log(`Successfully created document row with id: ${docId}`);
    
    // 2. Upload the file to Supabase Storage, passing metadata
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, fileContent, {
        contentType: "application/octet-stream",
        upsert: true,
        // This metadata is crucial for the Edge Function
        metadata: {
            doc_id: docId,
            user_id: USER_ID_FOR_TESTING
        }
      });
    if (uploadError) throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    console.log(`Successfully uploaded ${fileName} to storage.`);

    // 3. Poll the 'documents' table to see the results
    console.log("Waiting for classification (up to 30s)...");
    let classifiedDoc = null;
    for (let i = 0; i < 15; i++) {
        await new Promise(res => setTimeout(res, 2000));
        const { data, error } = await supabase.from("documents").select("*").eq("id", docId).single();
        if (error) throw new Error(`Polling failed: ${error.message}`);
        
        if (data.doc_category && data.doc_category !== 'processing') {
            classifiedDoc = data;
            break;
        }
    }

    if (classifiedDoc) {
      console.log("✅ TEST PASSED!");
      console.log({
        doc_type: classifiedDoc.doc_category,
        confidence: classifiedDoc.confidence_score,
        reasoning: classifiedDoc.reasoning,
        expiry_date: classifiedDoc.expiry_date,
      });
    } else {
      console.error("❌ TEST FAILED: Document was not classified in time.");
    }

  } catch (error) {
    console.error(`❌ TEST FAILED: ${error.message}`);
  } finally {
    console.log("--- Cleaning up test artifacts ---");
    try {
      // 1. Delete from storage
      const { error: storageErr } = await supabase.storage.from("documents").remove([storagePath]);
      if (storageErr) console.error(`Storage cleanup error for ${storagePath}:`, storageErr.message);

      // 2. Delete from dependent tables first
      await supabase.from("gaps").delete().eq("doc_id", docId);
      await supabase.from("processing_logs").delete().eq("document_id", docId);
      
      // 3. Delete the main document record
      const { error: docErr } = await supabase.from("documents").delete().eq("id", docId);
      if (docErr) console.error(`Document table cleanup error for ID ${docId}:`, docErr.message);

      console.log(`Cleanup complete for doc ID: ${docId}`);
    } catch (cleanupError) {
      console.error(`An error occurred during cleanup for doc ID ${docId}:`, cleanupError.message);
    }
    console.log(`--- Finished test for: ${filePath} ---\n`);
  }
}

// --- Main Execution ---
const testDir = path.join(Deno.cwd(), "supabase", "tests", "sample_docs");

for await (const dirEntry of Deno.readDir(testDir)) {
    if (dirEntry.isFile) {
        await runTest(path.join(testDir, dirEntry.name));
    }
} 