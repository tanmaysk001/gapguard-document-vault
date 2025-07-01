-- Add chatbot-related tables for RAG functionality
-- This migration adds support for document embeddings and chat history

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Table to store document embeddings for RAG
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID format
  content_chunk TEXT NOT NULL,
  embedding vector(768), -- Gemini text-embedding-004 size
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_doc_chunk UNIQUE (document_id, chunk_index)
);

-- Index for fast vector similarity search
CREATE INDEX idx_document_embeddings_vector ON document_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for user-specific queries
CREATE INDEX idx_document_embeddings_user ON document_embeddings(user_id);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for user's chat sessions
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fetching messages by session
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

-- RLS Policies for document_embeddings
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own embeddings"
ON document_embeddings FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY "System can insert embeddings"
ON document_embeddings FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

-- RLS Policies for chat_sessions
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chat sessions"
ON chat_sessions FOR ALL
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- RLS Policies for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their sessions"
ON chat_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE chat_sessions.id = chat_messages.session_id
    AND chat_sessions.user_id = auth.uid()::text
  )
);

CREATE POLICY "Users can insert messages to their sessions"
ON chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE chat_sessions.id = chat_messages.session_id
    AND chat_sessions.user_id = auth.uid()::text
  )
);

-- Function to update session last_message_at
CREATE OR REPLACE FUNCTION update_session_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update session timestamp on new message
CREATE TRIGGER update_session_timestamp
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_session_last_message(); 