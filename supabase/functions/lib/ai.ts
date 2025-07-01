// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
// @deno-types="https://esm.sh/@google/generative-ai@0.5.0"
// @deno-types="https://deno.land/x/zod@v3.22.2/mod.ts"
// deno-lint-ignore-file no-explicit-any
// @ts-ignore: Deno global
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "https://esm.sh/@google/generative-ai@0.5.0";
import { z } from "https://deno.land/x/zod@v3.22.2/mod.ts";
import { toArrayBuffer } from "https://deno.land/std@0.224.0/streams/to_array_buffer.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const GEMINI_MODEL_NAME = "gemini-2.0-flash";

export async function retry<T>(fn: () => Promise<T>, attempts = 3, delay = 1000): Promise<T> {
  let lastError: Error = new Error('Retry mechanism failed.');
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Error) {
      lastError = error;
      console.error(`Attempt ${i + 1} failed: ${error.message}`);
      } else {
        lastError = new Error(String(error));
        console.error(`Attempt ${i + 1} failed with non-error type: ${String(error)}`);
      }
      
      if (i < attempts - 1) {
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
  }
  throw lastError;
}

/**
 * Extracts raw text from a document (PDF, DOCX, image) using Gemini 1.5 Flash.
 * This function fetches the file, converts it to base64, and sends it to Gemini
 * with a prompt that asks for OCR and text extraction.
 *
 * @param fileUrl The public URL of the file to process.
 * @param fileMimeType The MIME type of the file.
 * @returns The extracted raw text content of the file.
 */
export async function extractTextFromDocument(fileUrl: string, fileMimeType: string): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY environment variable not set!");

  console.log(`Starting text extraction with Gemini for file: ${fileUrl}`);

  // --- Step 1: Fetch the file and convert to a generative part ---
  console.log("Fetching file blob...");
  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) {
    throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
  }
  if (!fileResponse.body) {
    throw new Error("File response has no body.");
  }
  const arrayBuffer = await toArrayBuffer(fileResponse.body);
  const fileBase64 = encodeBase64(arrayBuffer);
  console.log(`File fetched and encoded. Size: ${fileBase64.length} chars.`);
  
  const filePart = {
    inlineData: {
      data: fileBase64,
      mimeType: fileMimeType,
    },
  };

  // --- Step 2: Extract raw text with Gemini ---
  const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = ai.getGenerativeModel({ model: GEMINI_MODEL_NAME });
  
  // A simple prompt asking for text extraction.
  const prompt = "Extract all text from this document. If it is an image, perform OCR. Do not provide any commentary, summary, or formatting. Return only the raw, full text content.";

  const generationResult = await retry(() => model.generateContent({
    contents: [{ role: "user", parts: [ { text: prompt }, filePart ] }],
    generationConfig: {
      temperature: 0.0, // Set to 0 for deterministic text extraction
    },
    safetySettings: [{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }],
  }));
  
  const geminiResponse = generationResult.response;
  const candidate = geminiResponse.candidates?.[0];

  if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    const blockReason = geminiResponse.promptFeedback?.blockReason;
    const blockMessage = geminiResponse.promptFeedback?.blockReasonMessage;
    console.error("Gemini Response Error:", JSON.stringify(geminiResponse, null, 2));
    throw new Error(`Gemini failed to return content. Block reason: ${blockReason || 'N/A'}. Message: ${blockMessage || 'No details provided.'}`);
  }

  const text = candidate.content.parts[0].text;
  if (typeof text !== 'string') {
    console.error("Gemini did not return text in response part:", JSON.stringify(candidate, null, 2));
    throw new Error("Gemini response is missing text content.");
  }
  
  console.log(`Gemini text extraction complete. Extracted ${text.length} characters.`);
  
  return text;
}

// --- AI-POWERED RULE SUGGESTIONS ---

export const SuggestionSchema = z.object({
  suggestions: z.array(z.object({
    rule_name: z.string().min(1),
    reason: z.string().min(1)
  }))
});
export type AISuggestions = z.infer<typeof SuggestionSchema>;

export function createSuggestionPrompt(categories: string[]): string {
  return `
    You are an expert compliance assistant for GapGuard. Your task is to analyze a list of document categories a user has already provided and suggest a STRICTLY DEDUPLICATED, SHORT checklist of the MOST ESSENTIAL, UNIQUE, and NON-OVERLAPPING related documents they might need for compliance in the United States.

    CRITICAL DEDUPLICATION RULES:
    1. ABSOLUTELY NO semantic duplicates. "Bank Account Details", "Bank Account Details for Direct Deposit", and "Direct Deposit Form" are ALL THE SAME THING - only suggest ONE canonical name.
    2. "Professional License", "Professional License or Certification", and "Professional Certification" are ALL THE SAME - pick ONE.
    3. "Form I-9", "I-9 Employment Eligibility Verification", and "Employment Eligibility Verification" are ALL THE SAME - pick ONE.
    4. Before adding ANY suggestion, mentally check: "Does this requirement already exist in my list under a different name?" If yes, DO NOT ADD IT.
    5. Use the most common, standard official name for each document type.
    6. Return a JSON object with a single key "suggestions". The value should be an array of objects.
    7. Each object must have "rule_name" (the ONE canonical name) and "reason" (brief explanation).
    8. MAXIMUM 3 suggestions total. Focus on the most critical gaps only.
    9. Do NOT suggest anything semantically similar to what the user already has.
    10. Do NOT add explanations outside the JSON object.

    DOCUMENT CONTEXT:
    The user has already provided documents in the following categories:
    ${JSON.stringify(categories)}

    BEFORE suggesting anything, ask yourself:
    - Is this exactly the same requirement as something already in my list?
    - Is this a variation of something the user already has?
    - Is this truly essential for legal compliance?

    If you cannot find 3 truly unique, essential suggestions, return fewer suggestions rather than duplicates.

    JSON SCHEMA:
    {
      "suggestions": [
        {
          "rule_name": "string (ONE canonical name only)",
          "reason": "string"
        }
      ]
    }
  `;
}

export async function suggestRules(categories: string[]): Promise<AISuggestions> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY environment variable not set!");

  console.log(`Starting rule suggestion analysis for categories: ${JSON.stringify(categories)}`);

  const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = ai.getGenerativeModel({ model: GEMINI_MODEL_NAME });
  const prompt = createSuggestionPrompt(categories);

  const generationResult = await retry(() => model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3, // Slightly higher temp for more creative/relevant suggestions
    },
    safetySettings: [{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }],
  }));
  
  const geminiResponse = generationResult.response;
  const candidate = geminiResponse.candidates?.[0];

  if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    const blockReason = geminiResponse.promptFeedback?.blockReason;
    const blockMessage = geminiResponse.promptFeedback?.blockReasonMessage;
    console.error("Gemini Response Error:", JSON.stringify(geminiResponse, null, 2));
    throw new Error(`Gemini failed to return content. Block reason: ${blockReason || 'N/A'}. Message: ${blockMessage || 'No details provided.'}`);
  }

  const text = candidate.content.parts[0].text;
  if (!text) {
    console.error("Gemini did not return text in response part:", JSON.stringify(candidate, null, 2));
    throw new Error("Gemini response is missing text content.");
  }
  
  console.log("Gemini suggestion analysis complete. Parsing result...");
  
  const cleanedText = text.replace(/^```json\s*/, '').replace(/```$/, '');
  
  try {
    const result = JSON.parse(cleanedText);
    console.log("Suggestion analysis successful:", result);
    return SuggestionSchema.parse(result);
  } catch (e) {
    console.error("Failed to parse Gemini suggestion response:", cleanedText);
    if (e instanceof z.ZodError) {
      console.error("Zod validation errors:", e.errors);
      throw new Error(`Gemini suggestion response failed Zod validation: ${e.message}`);
    }
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to parse Gemini suggestion response as JSON: ${message}`);
  }
}

// --- RAG FUNCTIONALITY FOR CHATBOT ---

/**
 * Splits text into overlapping chunks for better context retention during embedding generation.
 */
export function chunkText(text: string, maxChunkSize = 1000, overlap = 100): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Clean the text - remove excessive whitespace and normalize
  const cleanText = text.replace(/\s+/g, ' ').trim();
  
  if (cleanText.length <= maxChunkSize) {
    return [cleanText];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < cleanText.length) {
    let end = start + maxChunkSize;
    
    // If we're not at the end of the text, try to find a good breaking point
    if (end < cleanText.length) {
      // Look for sentence endings first
      const sentenceEnd = cleanText.lastIndexOf('.', end);
      const questionEnd = cleanText.lastIndexOf('?', end);
      const exclamationEnd = cleanText.lastIndexOf('!', end);
      
      const bestSentenceEnd = Math.max(sentenceEnd, questionEnd, exclamationEnd);
      
      if (bestSentenceEnd > start + (maxChunkSize * 0.5)) {
        end = bestSentenceEnd + 1;
      } else {
        // Fall back to word boundaries
        const lastSpace = cleanText.lastIndexOf(' ', end);
        if (lastSpace > start + (maxChunkSize * 0.5)) {
          end = lastSpace;
        }
      }
    }

    chunks.push(cleanText.slice(start, end).trim());
    
    // Move start position with overlap
    start = Math.max(start + 1, end - overlap);
  }

  return chunks.filter(chunk => chunk.length > 20); // Filter out very small chunks
}

/**
 * Generates embeddings using Google Gemini's text-embedding-004 model.
 * This is free, production-ready, and more cost-effective than OpenAI.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set!");
  }

  console.log(`Generating Gemini embedding for text of length: ${text.length}`);

  const response = await retry(async () => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: {
          parts: [{ text }]
        },
        taskType: "RETRIEVAL_DOCUMENT" // Optimize for document search/RAG
      })
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Gemini Embeddings API error: ${res.status} ${res.statusText} - ${errorBody}`);
    }

    return res.json();
  });

  if (!response.embedding || !response.embedding.values) {
    throw new Error("Invalid response from Gemini embeddings API");
  }

  console.log(`Gemini embedding generated successfully. Dimensions: ${response.embedding.values.length}`);
  return response.embedding.values;
}

/**
 * Generates embeddings optimized for search queries using Gemini.
 * Uses RETRIEVAL_QUERY task type for better semantic matching.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set!");
  }

  console.log(`Generating Gemini query embedding for: "${query.substring(0, 50)}..."`);

  const response = await retry(async () => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: {
          parts: [{ text: query }]
        },
        taskType: "RETRIEVAL_QUERY" // Optimize for search queries
      })
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Gemini Query Embeddings API error: ${res.status} ${res.statusText} - ${errorBody}`);
    }

    return res.json();
  });

  if (!response.embedding || !response.embedding.values) {
    throw new Error("Invalid response from Gemini query embeddings API");
  }

  console.log(`Gemini query embedding generated successfully. Dimensions: ${response.embedding.values.length}`);
  return response.embedding.values;
} 