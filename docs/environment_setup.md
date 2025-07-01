# Environment Setup for Phase 3 RAG Implementation

## Required Environment Variables

### For Local Development
Add these to your `.env.local` file:

```bash
# Only need Gemini API key - used for both chat AND embeddings!
GEMINI_API_KEY=...

# Existing variables (already configured)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CLERK_JWKS_URL=...
CLERK_ISSUER=...
PRODUCTION_CORS_ORIGIN=...
```

### For Supabase Edge Functions
The `GEMINI_API_KEY` should already be configured in your Supabase project dashboard from previous work. No additional API keys needed!

### Cost Estimation

**Gemini Embeddings (text-embedding-004):**
- **Price**: **FREE** up to 15,000 requests/minute
- **Document Processing**: **$0** per document
- **Chat Queries**: **$0** per question

**Example Monthly Costs:**
- 100 documents: **FREE**
- 1000 chat queries: **FREE**  
- Total estimated: **$0** for typical usage (massive savings!)

### Supabase Configuration

The following is already configured in your migrations:
- ✅ `vector` extension enabled
- ✅ `document_embeddings` table created
- ✅ Vector indexes for similarity search
- ✅ RLS policies for security

### Deployment Steps

1. **Add OpenAI API key** to environment variables
2. **Deploy updated Edge Functions** with new embedding logic
3. **Test with document upload** to verify embeddings generation
4. **Verify vector search** is working in database

### Testing Environment Variables

Test that embeddings work with this simple query:
```sql
-- Check if embeddings are being generated
SELECT COUNT(*) as embedding_count 
FROM document_embeddings 
WHERE user_id = 'your_user_id';
```

### Troubleshooting

**Common Issues:**
1. **"OPENAI_API_KEY not set"** → Check environment variable configuration
2. **"Embedding generation failed"** → Verify API key validity and quota
3. **"Vector index error"** → Ensure `vector` extension is enabled
4. **"Permission denied"** → Check RLS policies are correctly applied

**Debug Steps:**
1. Check Supabase Edge Function logs
2. Verify environment variables in dashboard
3. Test OpenAI API key separately
4. Monitor token usage and quotas 