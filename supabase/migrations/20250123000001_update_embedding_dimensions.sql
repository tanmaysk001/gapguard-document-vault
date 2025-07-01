-- Update embedding dimensions from OpenAI (1536) to Gemini (768)
-- This migration is safe to run even if no data exists yet

-- Drop the existing vector index
DROP INDEX IF EXISTS idx_document_embeddings_vector;

-- Clear any existing embeddings (since dimensions are changing)
-- This is safe since embeddings will be regenerated on next document upload
DELETE FROM document_embeddings;

-- Update the column type to use Gemini's 768 dimensions
ALTER TABLE document_embeddings 
ALTER COLUMN embedding TYPE vector(768);

-- Recreate the vector index for the new dimensions
CREATE INDEX idx_document_embeddings_vector ON document_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100); 