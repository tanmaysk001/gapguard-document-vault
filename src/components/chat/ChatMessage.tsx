import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@clerk/clerk-react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { user } = useAuth();
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      "flex gap-3",
      isUser && "flex-row-reverse"
    )}>
      {/* Avatar */}
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
        isUser ? "bg-purple-100" : "bg-gray-100"
      )}>
        {isUser ? (
          <User className="h-5 w-5 text-purple-600" />
        ) : (
          <Bot className="h-5 w-5 text-gray-600" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn(
        "flex flex-col gap-1 max-w-[80%]",
        isUser && "items-end"
      )}>
        <div className={cn(
          "rounded-lg px-3 py-2 text-sm",
          isUser 
            ? "bg-purple-600 text-white" 
            : "bg-gray-100 text-gray-900"
        )}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(message.created_at).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit' 
          })}
        </span>
      </div>
    </div>
  );
} 