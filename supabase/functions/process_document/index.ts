// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
// @deno-types="https://esm.sh/@supabase/supabase-js@2"
// @ts-ignore: Deno global
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtVerify, createRemoteJWKSet } from "https://deno.land/x/jose@v4.14.4/index.ts";
import { extractTextFromDocument, chunkText, generateEmbedding } from "../lib/ai.ts";
import mammoth from "https://esm.sh/mammoth@1.7.2";
import { Database } from "../lib/database.types.ts";
import { z } from "https://deno.land/x/zod@v3.22.2/mod.ts";

// Extended Database type to include new production hardening features
type ExtendedDatabase = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      rate_limit_usage: {
        Row: {
          id: string;
          user_id: string;
          request_count: number;
          last_request_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          request_count?: number;
          last_request_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          request_count?: number;
          last_request_at?: string;
          created_at?: string;
        };
      };
    };
    Functions: Database['public']['Functions'] & {
      check_rate_limit: {
        Args: {
          p_user_id: string;
          p_max_requests?: number;
          p_window_hours?: number;
        };
        Returns: boolean;
      };
      increment_request_count: {
        Args: {
          p_user_id: string;
        };
        Returns: void;
      };
    };
  };
};

// --- Environment Variable Validation ---
const REQUIRED_ENV_VARS = [
  "CLERK_JWKS_URL", 
  "CLERK_ISSUER", 
  "GEMINI_API_KEY", // Used for both document analysis AND embeddings
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
const CLERK_JWKS_URL = Deno.env.get("CLERK_JWKS_URL")!;
const CLERK_ISSUER = Deno.env.get("CLERK_ISSUER")!;
const JWKS = createRemoteJWKSet(new URL(CLERK_JWKS_URL));

// --- PRODUCTION CONFIGURATION ---
const RATE_LIMIT_MAX_REQUESTS = 100;
const RATE_LIMIT_WINDOW_HOURS = 24;
const MAX_FILE_SIZE_DOCX = 10 * 1024 * 1024; // 10MB
const MAX_FILE_SIZE_PDF_IMAGE = 20 * 1024 * 1024; // 20MB
const MIN_TEXT_LENGTH = 10; // Minimum chars to consider file valid

// --- Zod Schema for Request Body ---
const RequestBodySchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().positive().optional(),
});

// --- CORE LOGIC ---

// --- DYNAMIC CORS ---
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const productionOrigin = Deno.env.get("PRODUCTION_CORS_ORIGIN")!;

  // Define a list of allowed origins.
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173", // Default Vite dev port
    "http://localhost:8080",
    productionOrigin
  ];

  const commonHeaders = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-control-allow-headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace",
    "Vary": "Origin",
  };

  if (origin && allowedOrigins.includes(origin)) {
    return {
      ...commonHeaders,
      "Access-Control-Allow-Origin": origin,
    };
  }
  
  // Fallback for non-matching origins to a safe default (the production URL).
  return {
    ...commonHeaders,
    "Access-Control-Allow-Origin": productionOrigin,
  };
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

// --- Production Helper Functions ---
async function checkRateLimit(supabase: SupabaseClient<ExtendedDatabase>, userId: string): Promise<void> {
  // Check if user is within rate limits
  const { data: isWithinLimits, error } = await supabase
    .rpc('check_rate_limit', { 
      p_user_id: userId, 
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      p_window_hours: RATE_LIMIT_WINDOW_HOURS 
    });

  if (error) {
    console.error("Rate limit check error:", error);
    throw new Error("Unable to verify rate limits");
  }

  if (!isWithinLimits) {
    throw new Error(`Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW_HOURS} hours.`);
  }

  // Update rate limit usage
  const { error: updateError } = await supabase
    .from("rate_limit_usage")
    .upsert({ 
      user_id: userId,
      request_count: 1,
      last_request_at: new Date().toISOString()
    }, {
      onConflict: "user_id"
    });

  if (updateError) {
    // Try to increment if record exists
    const { error: incrementError } = await supabase
      .rpc('increment_request_count', { p_user_id: userId });
    
    if (incrementError) {
      console.error("Rate limit update error:", incrementError);
      // Don't throw here - rate limiting is not critical enough to block processing
    }
  }
}

function validateFileSize(fileType: string, fileSize?: number): void {
  if (!fileSize) {
    return; // Optional field, skip validation
  }

  const isDOCX = fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const maxSize = isDOCX ? MAX_FILE_SIZE_DOCX : MAX_FILE_SIZE_PDF_IMAGE;
  const fileTypeName = isDOCX ? "DOCX" : "PDF/Image";

  if (fileSize > maxSize) {
    throw new Error(`File too large. Maximum ${fileTypeName} file size is ${Math.round(maxSize / 1024 / 1024)}MB, but received ${Math.round(fileSize / 1024 / 1024)}MB.`);
  }
}

async function checkFileTypeConflict(supabase: SupabaseClient<ExtendedDatabase>, userId: string, fileName: string, fileType: string): Promise<void> {
  const { data: existingDoc, error } = await supabase
    .from("documents")
    .select("file_type")
    .eq("user_id", userId)
    .eq("file_name", fileName)
    .single();

  if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
    console.error("File type conflict check error:", error);
    return; // Don't block processing for this check
  }

  if (existingDoc && existingDoc.file_type !== fileType) {
    throw new Error(`File type conflict: A file named "${fileName}" already exists with type "${existingDoc.file_type}". Please rename your file or delete the existing one.`);
  }
}

function validateExtractedText(documentText: string, fileName: string): void {
  const trimmedText = documentText.trim();
  
  if (trimmedText.length < MIN_TEXT_LENGTH) {
    throw new Error(`No readable text found in "${fileName}". Please ensure the file contains text content and try again.`);
  }
}

async function handleGeminiExtraction(fileUrl: string, fileType: string): Promise<string> {
  try {
    console.log("Processing PDF or image file with Gemini.");
    return await extractTextFromDocument(fileUrl, fileType);
  } catch (geminiError) {
    console.error("Gemini extraction failed:", geminiError);
    const message = geminiError instanceof Error ? geminiError.message : String(geminiError);
    
    // Check for specific error types
    if (message.includes("timeout") || message.includes("TIMEOUT")) {
      throw new Error("Document processing timed out. Please try again with a smaller file.");
    } else if (message.includes("quota") || message.includes("QUOTA") || message.includes("rate limit")) {
      throw new Error("AI service temporarily unavailable due to high demand. Please try again in a few minutes.");
    } else if (message.includes("authentication") || message.includes("API key")) {
      throw new Error("AI service configuration error. Please contact support.");
    } else {
      throw new Error("Failed to extract text from document. Please ensure the file is readable and try again.");
    }
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Manually verify the JWT and get the user ID
    const userId = await getUserIdFromJwt(req);

    // 2. Create a Supabase admin client to perform privileged operations
    // This is required because we are bypassing the standard user auth flow.
    const supabaseAdmin = createClient<ExtendedDatabase>(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Get file path from the request body and validate it
    const body = await req.json();
    const validation = RequestBodySchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: "Invalid request body", details: validation.error.flatten() }), { status: 400, headers: corsHeaders });
    }
    const { fileUrl, fileName, fileType, fileSize } = validation.data;

    // 4. PRODUCTION SAFEGUARDS
    // 4a. Rate limiting check
    await checkRateLimit(supabaseAdmin, userId);
    
    // 4b. File size validation
    validateFileSize(fileType, fileSize);
    
    // 4c. File type conflict check
    await checkFileTypeConflict(supabaseAdmin, userId, fileName, fileType);

    // 5. Upsert document record to handle re-uploads and get a document ID
    const { data: doc, error: upsertError } = await supabaseAdmin
      .from("documents")
      .upsert(
        {
          user_id: userId,
          file_name: fileName,
          file_url: fileUrl,
          file_type: fileType,
          file_size: fileSize,
          status: "processing", // Reset status on every upload attempt
        },
        {
          onConflict: "user_id,file_name", // The columns that form the unique constraint
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("Error upserting document:", upsertError);
      throw new Error(`DB upsert error: ${upsertError.message}`);
    }
    
    const docId = doc.id;

    let documentText: string;

    // 6. Extract text based on file type
    // For DOCX, use Mammoth.js. For PDF/Images, use Gemini.
    if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      console.log("Processing DOCX file with Mammoth.js");
      try {
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch DOCX file: ${fileResponse.statusText}`);
        }
        const arrayBuffer = await fileResponse.arrayBuffer();
        const mammothResult = await mammoth.extractRawText({ buffer: arrayBuffer });
        documentText = mammothResult.value;
        console.log(`Successfully extracted ${documentText.length} characters from DOCX.`);
      } catch (mammothError) {
        console.error("Error processing DOCX with Mammoth.js:", mammothError);
        const message = mammothError instanceof Error ? mammothError.message : String(mammothError);
        throw new Error(`DOCX processing failed: ${message}`);
      }
    } else {
      documentText = await handleGeminiExtraction(fileUrl, fileType);
    }

    // 7. Validate extracted text
    validateExtractedText(documentText, fileName);

    // 8. Generate embeddings for RAG functionality
    try {
      console.log("Generating embeddings for document...");
      const textChunks = chunkText(documentText, 1000, 100);
      console.log(`Created ${textChunks.length} text chunks for embedding`);

      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        console.log(`Processing chunk ${i + 1}/${textChunks.length} (${chunk.length} chars)`);

        try {
          const embedding = await generateEmbedding(chunk);
          const { error: embeddingError } = await supabaseAdmin
            .from("document_embeddings")
            .insert({
              document_id: docId,
              user_id: userId,
              content_chunk: chunk,
              embedding: `[${embedding.join(',')}]`,
              chunk_index: i,
              metadata: { file_name: fileName }
            });

          if (embeddingError) {
            console.error(`Error storing embedding for chunk ${i}:`, embeddingError);
            throw new Error(`Failed to store embedding for chunk ${i}: ${embeddingError.message}`);
          } else {
            console.log(`Successfully stored embedding for chunk ${i + 1}`);
          }
        } catch (chunkError) {
          console.error(`Error processing chunk ${i}:`, chunkError);
          throw new Error(`Failed to generate embedding for chunk ${i}: ${chunkError instanceof Error ? chunkError.message : String(chunkError)}`);
        }
      }

      // Only mark document as valid if all embeddings succeeded
      const { error: updateError } = await supabaseAdmin
        .from("documents")
        .update({ status: "valid" })
        .eq("id", docId)
        .select()
        .single();

      if (updateError) {
        console.error("DB Update Error:", updateError);
        throw new Error(`DB update error: ${updateError.message}`);
      }

      console.log("Embedding generation completed and document marked as valid");
      return new Response(JSON.stringify({ success: true, documentId: docId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (embeddingError) {
      // If embedding fails, document remains in 'processing' status
      console.error("Error during embedding generation:", embeddingError);
      return new Response(JSON.stringify({
        success: false,
        documentId: docId,
        error: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
        message: "Embedding generation failed. Document remains in 'processing' status."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("Processing Error:", errorMessage);
    
    // Determine appropriate HTTP status code based on error type
    let statusCode = 500;
    if (errorMessage.includes("Rate limit exceeded")) {
      statusCode = 429; // Too Many Requests
    } else if (errorMessage.includes("File too large")) {
      statusCode = 413; // Payload Too Large
    } else if (errorMessage.includes("File type conflict")) {
      statusCode = 409; // Conflict
    } else if (errorMessage.includes("No readable text found")) {
      statusCode = 400; // Bad Request
    } else if (errorMessage.includes("timed out") || errorMessage.includes("temporarily unavailable")) {
      statusCode = 502; // Bad Gateway
    } else if (errorMessage.includes("Invalid request body") || errorMessage.includes("Missing Authorization")) {
      statusCode = 400; // Bad Request
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusCode,
    });
  }
}); 