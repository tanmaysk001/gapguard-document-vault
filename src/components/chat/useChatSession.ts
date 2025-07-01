import { useState, useEffect } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { useAuth } from '@clerk/clerk-react';
import { Message } from './ChatMessage';
import { useToast } from '@/hooks/use-toast';

export function useChatSession() {
  const supabase = useSupabase();
  const { userId, getToken } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Debug logging for troubleshooting
  console.log('[useChatSession] Hook state:', {
    hasSupabase: !!supabase,
    userId,
    sessionId,
    isInitialized,
    isLoading,
    error,
    messagesCount: messages.length
  });

  // Initialize or get existing session
  useEffect(() => {
    if (!supabase || !userId) {
      return;
    }

    const initSession = async () => {
      try {
        setError(null);
        setIsLoading(true);

        // Check for existing active session
        const { data: existingSessions, error: fetchError } = await supabase
          .from('chat_sessions')
          .select('*')
          .order('last_message_at', { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        if (existingSessions && existingSessions.length > 0) {
          // Use existing session
          const session = existingSessions[0];
          setSessionId(session.id);
          
          // Load messages from existing session
          const { data: existingMessages, error: messagesError } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', session.id)
            .order('created_at', { ascending: true });

          if (messagesError) throw messagesError;
          
          if (existingMessages) {
            setMessages(existingMessages);
          }
        } else {
          // Create new session
          const { data: newSession, error: createError } = await supabase
            .from('chat_sessions')
            .insert({
              user_id: userId,
              title: 'New Chat'
            })
            .select()
            .single();

          if (createError) throw createError;
          
          if (newSession) {
            setSessionId(newSession.id);
          }
        }
        
        setIsInitialized(true);

      } catch (err) {
        console.error('Chat session error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to initialize chat: ${errorMessage}`);
        
        // Show error to user
        toast({
          title: "Chat Error",
          description: `Unable to start chat session: ${errorMessage}`,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [supabase, userId]);

  const sendMessage = async (content: string) => {
    if (!supabase || !sessionId || !userId) return;
    const token = await getToken();
    
    setIsLoading(true);
    setError(null);

    try {
      // Add user message to UI immediately
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, userMessage]);

      // Save user message to database
      const { data: savedUserMessage, error: saveError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'user',
          content
        })
        .select()
        .single();

      if (saveError) throw saveError;

      // Call the chat_with_documents edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/chat_with_documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ question: content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get response from chatbot.');
      }

      const { answer } = await response.json();
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: answer,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message
      await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'assistant',
          content: assistantMessage.content
        });

    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    sessionId,
    isLoading,
    error,
    sendMessage,
    isInitialized
  };
} 