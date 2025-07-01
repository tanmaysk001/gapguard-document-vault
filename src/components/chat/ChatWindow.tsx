import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChatSession } from './useChatSession';
import { useAuth } from '@clerk/clerk-react';

interface ChatWindowProps {
  onClose: () => void;
}
export function ChatWindow({ onClose }: ChatWindowProps) {
  const { isSignedIn } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    isLoading,
    sendMessage,
    sessionId,
    error,
    isInitialized
  } = useChatSession();

  if (process.env.NODE_ENV === 'development') {
    // Debug logging for troubleshooting (development only)
    console.log('[ChatWindow] State Update:', {
      isLoading,
      isInitialized,
      error,
      sessionId,
      messageCount: messages.length,
    });
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <Card className={cn(
      "w-[380px] h-[600px] flex flex-col",
      "shadow-2xl border-gray-200",
      "max-w-[90vw] max-h-[90vh]" // Responsive sizing without changing position
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
            <Bot className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">GapGuard Assistant</h3>
            <p className="text-xs text-gray-500">Ask me about your documents</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {!isInitialized && !error && (
            <div className="text-center text-gray-500 py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">Initializing chat...</p>
              <div className="flex justify-center gap-1 mt-2">
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-red-500 py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 text-red-300" />
              <p className="text-sm font-medium">Chat Unavailable</p>
              <p className="text-xs mt-2">{error}</p>
              <p className="text-xs mt-2 text-gray-400">Please check the console for more details.</p>
            </div>
          )}

          {isInitialized && !error && messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">Hi there! 👋</p>
              <p className="text-xs mt-2">Ask me anything about your uploaded documents.</p>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium">Try asking:</p>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">"What documents are expiring soon?"</p>
                  <p className="text-xs text-gray-400">"Show me my insurance policies"</p>
                  <p className="text-xs text-gray-400">"What's the status of my passport?"</p>
                </div>
              </div>
            </div>
          )}
          
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Bot className="h-5 w-5 text-gray-600" />
              </div>
              <div className="flex gap-1">
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <ChatInput onSendMessage={sendMessage} disabled={isLoading || !isInitialized || !!error} />
      </div>
    </Card>
  );
} 