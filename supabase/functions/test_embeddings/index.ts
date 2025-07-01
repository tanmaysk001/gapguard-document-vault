// Test function to verify Gemini embeddings are working
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateEmbedding, generateQueryEmbedding } from "../lib/ai.ts";

serve(async (req) => {
  // Simple CORS for testing
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Testing Gemini embeddings...");

    // Test document embedding
    const sampleDocumentText = `
      Document Type: passport
      File Name: john_passport.pdf
      Analysis: This appears to be a valid US passport document with clear identification information.
      Issue Date: 2020-01-15
      Expiry Date: 2030-01-15
      Confidence Score: 0.95
    `;

    console.log("Generating document embedding...");
    const docEmbedding = await generateEmbedding(sampleDocumentText);
    
    // Test query embedding  
    const sampleQuery = "When does my passport expire?";
    console.log("Generating query embedding...");
    const queryEmbedding = await generateQueryEmbedding(sampleQuery);

    // Calculate similarity (cosine similarity approximation)
    const dotProduct = docEmbedding.reduce((sum, a, i) => sum + a * queryEmbedding[i], 0);
    const magnitudeDoc = Math.sqrt(docEmbedding.reduce((sum, a) => sum + a * a, 0));
    const magnitudeQuery = Math.sqrt(queryEmbedding.reduce((sum, a) => sum + a * a, 0));
    const similarity = dotProduct / (magnitudeDoc * magnitudeQuery);

    const result = {
      success: true,
      test_results: {
        document_embedding: {
          dimensions: docEmbedding.length,
          sample_values: docEmbedding.slice(0, 5),
          magnitude: magnitudeDoc
        },
        query_embedding: {
          dimensions: queryEmbedding.length,
          sample_values: queryEmbedding.slice(0, 5),
          magnitude: magnitudeQuery
        },
        similarity_score: similarity,
        expected_dimensions: 768,
        dimensions_match: docEmbedding.length === 768 && queryEmbedding.length === 768
      },
      message: `Gemini embeddings working! Similarity between passport document and expiry query: ${similarity.toFixed(4)}`
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Embedding test failed:", error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: "Gemini embeddings test failed"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}); 