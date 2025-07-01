# Phase 3: RAG Chatbot Implementation Plan

## Overview
Transform the placeholder chatbot into an intelligent document-aware assistant using Retrieval-Augmented Generation (RAG).

## Phase 3A: Document Embeddings Foundation

### 1. Add Text Chunking Function
**File**: `supabase/functions/lib/ai.ts`

Add function to break document content into searchable chunks:
```typescript
export function chunkText(text: string, maxChunkSize = 1000, overlap = 100): string[] {
  // Implementation to split text into overlapping chunks
  // This ensures context isn't lost at chunk boundaries
}
```

### 2. Add Gemini Embeddings Integration
**File**: `supabase/functions/lib/ai.ts`

Add function to generate embeddings:
```typescript
export async function generateEmbedding(text: string): Promise<number[]> {
  // Call Google Gemini API to generate embeddings for text chunk
  // Using text-embedding-004 model (768-dimensional vector, FREE tier)
  // Much more cost-effective than OpenAI alternatives
}
```

### 3. Modify Document Processing Pipeline
**File**: `supabase/functions/process_document/index.ts`

Add embedding generation after Gemini analysis:
```typescript
// After successful Gemini analysis
if (analysisResult.content) {
  const chunks = chunkText(analysisResult.content);
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);
    await supabaseAdmin.from('document_embeddings').insert({
      document_id: docId,
      user_id: userId,
      content_chunk: chunk,
      embedding: embedding,
      chunk_index: index
    });
  }
}
```

## Phase 3B: RAG Chat Function

### 4. Create Chat Edge Function
**File**: `supabase/functions/chat_with_documents/index.ts`

Core RAG implementation:
```typescript
export async function chatWithDocuments(userId: string, message: string) {
  // 1. Generate embedding for user's question
  const questionEmbedding = await generateEmbedding(message);
  
  // 2. Find relevant document chunks via vector similarity
  const relevantChunks = await findSimilarChunks(userId, questionEmbedding);
  
  // 3. Construct context-aware prompt for Gemini
  const prompt = buildRAGPrompt(message, relevantChunks);
  
  // 4. Generate intelligent response
  const response = await callGeminiWithContext(prompt);
  
  return response;
}
```

### 5. Vector Similarity Search
**Function**: Find relevant document chunks
```sql
SELECT content_chunk, document_id, 1 - (embedding <=> $1) as similarity
FROM document_embeddings 
WHERE user_id = $2
ORDER BY embedding <=> $1
LIMIT 5;
```

### 6. Context-Aware Prompting
Build prompts that include relevant document context:
```typescript
function buildRAGPrompt(question: string, chunks: DocumentChunk[]): string {
  return `
You are GapGuard AI, an intelligent document assistant. Answer the user's question based on their uploaded documents.

CONTEXT FROM USER'S DOCUMENTS:
${chunks.map(c => `Document: ${c.filename}\nContent: ${c.content}`).join('\n\n')}

USER QUESTION: ${question}

Instructions:
- Answer based only on the provided document context
- If the answer isn't in the documents, say so politely
- Cite specific documents when relevant
- Be helpful and conversational
`;
}
```

## Phase 3C: Frontend Integration

### 7. Update Chat Hook
**File**: `src/components/chat/useChatSession.ts`

Replace placeholder with real RAG call:
```typescript
// Replace the simulation with:
const { data: response, error } = await supabase.functions.invoke('chat_with_documents', {
  body: { message: content, session_id: sessionId }
});

if (error) throw error;
const assistantMessage = response.message;
```

### 8. Add Better Loading States
- "Analyzing your documents..."
- "Generating response..."
- Progress indicators

### 9. Error Handling
- No documents uploaded yet
- AI service unavailable
- Network connectivity issues

## Technical Requirements

### Environment Variables Needed
```bash
GEMINI_API_KEY=...     # Already configured (now used for both chat AND embeddings)
# No additional API keys needed! Significant cost savings vs OpenAI
```

### Database Schema (Already Ready)
- ✅ `document_embeddings` table exists
- ✅ Vector indexes configured
- ✅ RLS policies in place

### Dependencies to Add
```typescript
// No additional dependencies needed!
// Gemini embeddings use the same Google AI SDK already configured
```

## Success Metrics

### Phase 3A Complete When:
- Documents generate embeddings during processing
- Embeddings stored in database correctly
- Vector search returns relevant chunks

### Phase 3B Complete When:
- Chat function returns document-aware responses
- Can answer questions about uploaded documents
- Properly handles edge cases (no documents, irrelevant questions)

### Phase 3C Complete When:
- Frontend connects to RAG backend
- Real-time responses replace placeholder
- Error handling works smoothly

## Testing Strategy

### 1. Unit Tests
- Text chunking function
- Embedding generation
- Vector similarity search

### 2. Integration Tests
- End-to-end document upload → embedding → chat flow
- Various document types (PDF, images)
- Multiple users with different documents

### 3. User Acceptance Tests
- Upload a passport, ask "When does my passport expire?"
- Upload insurance policy, ask "What's my coverage?"
- Ask about non-existent documents

## Risk Mitigation

### Potential Issues:
1. **Gemini API rate limits** - 15,000 requests/minute (very generous!)
2. **Large documents** - Chunk size optimization
3. **Vector search performance** - Database indexes and limits
4. **Context window limits** - Smart chunk selection

### Solutions:
1. **Rate limiting** monitoring (much less concern with free tier)
2. **Chunking strategy** testing with various document sizes
3. **Performance benchmarks** and optimization
4. **Intelligent context** ranking and filtering 