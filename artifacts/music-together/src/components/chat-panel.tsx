import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText("");
  };

  return (
    <div className="flex flex-col h-full bloom-card overflow-hidden border-none">
      <div className="p-5 border-b border-primary/5 bg-white/60">
        <h3 className="text-base font-medium text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Chat
        </h3>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/60 space-y-4 my-16">
            <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/40"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path></svg>
            </div>
            <p className="text-sm font-medium">Nói chào mọi người nhé!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg, i) => {
              const isMe = msg.userName === currentUser;
              const date = new Date(msg.timestamp);
              const timeStr = isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              return (
                <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-3 duration-500`}>
                  <div className="flex items-baseline gap-2 mb-1.5 px-1">
                    <span className="text-xs font-semibold text-foreground/70">{msg.userName}</span>
                    <span className="text-[10px] text-muted-foreground/50">{timeStr}</span>
                  </div>
                  <div className={`px-5 py-2.5 rounded-3xl max-w-[90%] break-words text-sm shadow-sm transition-all hover:shadow-md ${
                    isMe 
                      ? 'bg-gradient-to-br from-primary to-[#d4a0ab] text-white rounded-tr-none' 
                      : 'bg-white border border-primary/5 text-foreground rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-primary/5 bg-white/60">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="Gửi tin nhắn..." 
            className="bg-white border-primary/10 focus-visible:ring-primary/20 h-12 rounded-2xl px-5 shadow-sm"
          />
          <Button type="submit" size="icon" disabled={!text.trim()} className="rounded-2xl w-12 h-12 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 shrink-0 transition-transform hover:scale-105 active:scale-95">
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
