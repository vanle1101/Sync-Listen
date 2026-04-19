import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUser: string;
}

export function ChatPanel({ messages, onSendMessage, currentUser }: ChatPanelProps) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText("");
  };

  return (
    <div className="flex flex-col h-full bg-card/40 border border-white/5 rounded-xl overflow-hidden glass-panel">
      <div className="p-4 border-b border-white/5 bg-black/20">
        <h3 className="font-mono text-sm tracking-wider uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Room Chat
        </h3>
      </div>
      
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground space-y-3 opacity-50 my-12">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path></svg>
            <p className="text-sm">Say hi to everyone!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => {
              const isMe = msg.userName === currentUser;
              const date = new Date(msg.timestamp);
              const timeStr = isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              return (
                <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-medium text-white/70">{msg.userName}</span>
                    <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                  </div>
                  <div className={`px-4 py-2 rounded-2xl max-w-[85%] break-words ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-white/10 text-foreground rounded-tl-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
      
      <div className="p-3 border-t border-white/5 bg-black/20">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="Type a message..." 
            className="bg-black/40 border-white/10 focus-visible:ring-primary h-10 rounded-full px-4"
          />
          <Button type="submit" size="icon" disabled={!text.trim()} className="rounded-full w-10 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
