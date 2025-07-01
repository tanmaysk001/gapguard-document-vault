-- Fix chatbot RLS policies to work with Clerk authentication
-- This migration fixes the UUID/text mismatch in chat-related tables

-- Drop existing problematic policies for chat_sessions
DROP POLICY IF EXISTS "Users can manage their own chat sessions" ON chat_sessions;

-- Drop existing problematic policies for chat_messages  
DROP POLICY IF EXISTS "Users can view messages from their sessions" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages to their sessions" ON chat_messages;

-- Drop existing problematic policies for document_embeddings
DROP POLICY IF EXISTS "Users can view their own embeddings" ON document_embeddings;
DROP POLICY IF EXISTS "System can insert embeddings" ON document_embeddings;

-- Create new RLS policies for chat_sessions using get_jwt_claim
CREATE POLICY "Users can manage their own chat sessions"
ON chat_sessions FOR ALL
TO authenticated
USING (get_jwt_claim(auth.jwt()::text, 'sub') = user_id)
WITH CHECK (get_jwt_claim(auth.jwt()::text, 'sub') = user_id);

-- Create new RLS policies for chat_messages using get_jwt_claim
CREATE POLICY "Users can view messages from their sessions"
ON chat_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE chat_sessions.id = chat_messages.session_id
    AND chat_sessions.user_id = get_jwt_claim(auth.jwt()::text, 'sub')
  )
);

CREATE POLICY "Users can insert messages to their sessions"
ON chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_sessions
    WHERE chat_sessions.id = chat_messages.session_id
    AND chat_sessions.user_id = get_jwt_claim(auth.jwt()::text, 'sub')
  )
);

-- Create new RLS policies for document_embeddings using get_jwt_claim
CREATE POLICY "Users can view their own embeddings"
ON document_embeddings FOR SELECT
TO authenticated
USING (get_jwt_claim(auth.jwt()::text, 'sub') = user_id);

CREATE POLICY "System can insert embeddings"
ON document_embeddings FOR INSERT
TO authenticated
WITH CHECK (get_jwt_claim(auth.jwt()::text, 'sub') = user_id); 