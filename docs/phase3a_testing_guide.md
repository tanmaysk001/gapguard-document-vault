# Phase 3A Testing Guide: Gemini Embeddings

## Overview
Phase 3A adds document embedding generation using Google Gemini's `text-embedding-004` model. This enables the RAG (Retrieval-Augmented Generation) chatbot to find relevant document content when answering user questions.

## Pre-Testing Setup

### 1. Apply Database Migrations
Run the new migration to update embedding dimensions:

```bash
cd supabase
npx supabase db push
```

### 2. Verify Environment Variables
Ensure your Supabase project has the `GEMINI_API_KEY` configured:

1. Go to your Supabase dashboard
2. Navigate to **Settings** > **Edge Functions** > **Environment Variables**
3. Verify `GEMINI_API_KEY` is present (should already be configured)

### 3. Deploy Updated Edge Functions
Deploy the updated `process_document` function with Gemini embeddings:

```bash
cd supabase
npx supabase functions deploy process_document
```

## Testing Methods

### Method 1: Upload Test via Frontend

1. **Upload a Document**:
   - Go to your GapGuard application
   - Navigate to Documents page
   - Upload a test document (PDF, image, or DOCX)
   - Watch for processing completion

2. **Check Embedding Generation**:
   - Open browser developer tools
   - Go to Network tab
   - Look for the `process_document` Edge Function call
   - Check the response for successful processing

### Method 2: Database Verification

Check if embeddings were generated:

```sql
-- Check total embeddings count
SELECT COUNT(*) as total_embeddings FROM document_embeddings;

-- View recent embeddings with metadata
SELECT 
  id,
  document_id,
  chunk_index,
  LENGTH(content_chunk) as chunk_length,
  metadata->'file_name' as file_name,
  metadata->'doc_type' as doc_type,
  created_at
FROM document_embeddings 
ORDER BY created_at DESC 
LIMIT 10;

-- Check embedding dimensions (should be 768 for Gemini)
SELECT 
  vector_dims(embedding) as dimensions,
  COUNT(*) as count
FROM document_embeddings 
GROUP BY vector_dims(embedding);
```

### Method 3: Edge Function Logs

Monitor the Edge Function execution:

1. **View Logs**:
   ```bash
   cd supabase
   npx supabase functions logs process_document
   ```

2. **Look for these log messages**:
   - ✅ "Generating Gemini embedding for text of length: X"
   - ✅ "Gemini embedding generated successfully. Dimensions: 768"
   - ✅ "Created X text chunks for embedding"
   - ✅ "Successfully stored embedding for chunk X"
   - ✅ "Embedding generation completed"

### Method 4: API Testing with cURL

Test the embedding generation directly:

```bash
# Get your auth token from browser dev tools (Authorization header)
export AUTH_TOKEN="Bearer eyJ..."
export SUPABASE_URL="https://your-project.supabase.co"

# Upload a test file first, then trigger processing
curl -X POST "${SUPABASE_URL}/functions/v1/process_document" \
  -H "Authorization: ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "fileUrl": "https://your-test-file-url.pdf",
    "filePath": "test/sample.pdf", 
    "fileName": "sample.pdf",
    "fileType": "application/pdf",
    "fileSize": 12345
  }'
```

## Success Criteria

### ✅ Phase 3A is working correctly when:

1. **Documents generate embeddings**:
   - Each uploaded document creates multiple embedding rows
   - Embeddings have 768 dimensions (Gemini size)
   - Content chunks are meaningful and searchable

2. **Database integrity**:
   - `document_embeddings` table has records
   - Each embedding links to a valid `document_id`
   - Vector index exists and is functional

3. **No errors in logs**:
   - No "GEMINI_API_KEY not set" errors
   - No embedding API failures
   - Successful chunk processing messages

4. **Vector search works**:
   ```sql
   -- Test vector similarity search
   SELECT 
     content_chunk,
     metadata->'file_name' as file_name,
     1 - (embedding <=> (SELECT embedding FROM document_embeddings LIMIT 1)) as similarity
   FROM document_embeddings 
   ORDER BY embedding <=> (SELECT embedding FROM document_embeddings LIMIT 1)
   LIMIT 5;
   ```

## Troubleshooting

### Common Issues:

1. **"Invalid response from Gemini embeddings API"**
   - Check GEMINI_API_KEY is valid
   - Verify API quota isn't exceeded (15k requests/minute)

2. **"Vector dimension mismatch"**
   - Run the dimension update migration
   - Clear existing embeddings if needed

3. **"No embeddings generated"**
   - Check document processing logs
   - Verify text extraction is working
   - Ensure chunks are being created

### Debug Commands:

```sql
-- Check recent document processing
SELECT 
  id, file_name, doc_category, status, created_at
FROM documents 
ORDER BY created_at DESC 
LIMIT 5;

-- Count embeddings per document
SELECT 
  d.file_name,
  COUNT(e.id) as embedding_count
FROM documents d
LEFT JOIN document_embeddings e ON d.id = e.document_id
GROUP BY d.id, d.file_name
ORDER BY d.created_at DESC;
```

## Next Steps

Once Phase 3A is working:

1. **Phase 3B**: Create the RAG chat function that uses these embeddings
2. **Phase 3C**: Connect the frontend chatbot to the RAG backend
3. **Test end-to-end**: Upload documents, then ask questions about them

## Performance Notes

- **Free Tier**: Gemini embeddings are completely free
- **Rate Limits**: 15,000 requests/minute (very generous)
- **Dimensions**: 768 (more efficient than OpenAI's 1536)
- **Speed**: Fast generation, typically <1 second per chunk 