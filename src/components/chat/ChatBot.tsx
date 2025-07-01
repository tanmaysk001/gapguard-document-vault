import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChatWindow } from './ChatWindow';

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-4 right-4 z-40">
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full shadow-lg",
            "bg-purple-600 hover:bg-purple-700",
            "transition-all duration-300 ease-in-out",
            "hover:scale-110"
          )}
        >
          <MessageCircle className="h-6 w-6" />
          <span className="sr-only">Open chat</span>
        </Button>
      </div>

      {/* Chat Window - Overlaps the button when open */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50">
          <ChatWindow onClose={() => setIsOpen(false)} />
        </div>
      )}
    </>
  );
} 