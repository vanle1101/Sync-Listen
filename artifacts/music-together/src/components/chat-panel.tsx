import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Smile, ImageIcon, X } from "lucide-react";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUser: string;
}

const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Biểu cảm",
    icon: "😊",
    emojis: ["😊","😂","🤣","😍","🥰","🤩","😘","😋","😎","🤗","😄","😁","😉","🥹","😭","😢","😤","😡","🤔","🤭","😴","🥱","😈","🤪","🤐","🫠","🥺","😏","😒","🤯","🤫"],
  },
  {
    label: "Trái tim",
    icon: "❤️",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💕","💗","💓","💞","💖","💝","💘","♥️","🫶","💌","💟"],
  },
  {
    label: "Cử chỉ",
    icon: "👍",
    emojis: ["👍","👎","👏","🙌","🤝","🙏","👋","🤞","✌️","🤟","🤙","💪","👌","🫶","🫂","🤜","🤛","🫡","🫰","🤌","👊"],
  },
  {
    label: "Âm nhạc",
    icon: "🎵",
    emojis: ["🎵","🎶","🎸","🥁","🎹","🎻","🎺","🎷","🎤","🎧","📻","🎼","🎙️","🪗","🪘","🎻","🪕","🎚️","🎛️"],
  },
  {
    label: "Vui",
    icon: "🌸",
    emojis: ["🌸","🌺","🌻","🌹","🍀","🦋","🐱","🐻","🌙","⭐","🌈","🎉","🎀","🎁","🎂","🍕","🧁","✨","💫","🌟","🔥","🌊","🍓","🌿","🫧","🪄","🦄","🍦","🧸"],
  },
];

const IMAGE_URL_RE = /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|svg|avif)(\?[^\s]*)?$/i;

function isImageUrl(text: string) {
  return IMAGE_URL_RE.test(text.trim());
}

function MessageContent({ text }: { text: string }) {
  if (isImageUrl(text)) {
    return (
      <img
        src={text}
        alt="shared"
        className="max-w-[220px] rounded-2xl shadow-sm object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return <span className="whitespace-pre-wrap break-words">{text}</span>;
}

export function ChatPanel({ messages, onSendMessage, currentUser }: ChatPanelProps) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText("");
    setEmojiOpen(false);
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? text.length;
      const end = input.selectionEnd ?? text.length;
      const next = text.slice(0, start) + emoji + text.slice(end);
      setText(next);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setText((t) => t + emoji);
    }
  };

  const handleSendImage = () => {
    const url = imageUrl.trim();
    if (!url) return;
    onSendMessage(url);
    setImageUrl("");
    setImageOpen(false);
  };

  return (
    <div className="flex flex-col h-full bloom-card overflow-hidden border-none">
      <div className="p-5 border-b border-primary/5 bg-white/60 shrink-0">
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
              const imgMsg = isImageUrl(msg.text);

              return (
                <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-3 duration-500`}>
                  <div className="flex items-baseline gap-2 mb-1.5 px-1">
                    <span className="text-xs font-semibold text-foreground/70">{msg.userName}</span>
                    <span className="text-[10px] text-muted-foreground/50">{timeStr}</span>
                  </div>
                  <div className={`${imgMsg ? 'p-1' : 'px-5 py-2.5'} rounded-3xl max-w-[90%] break-words text-sm shadow-sm transition-all hover:shadow-md ${
                    isMe
                      ? 'bg-gradient-to-br from-primary to-[#d4a0ab] text-white rounded-tr-none'
                      : 'bg-white border border-primary/5 text-foreground rounded-tl-none'
                  }`}>
                    <MessageContent text={msg.text} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image URL input overlay */}
      {imageOpen && (
        <div className="px-4 py-3 border-t border-primary/5 bg-white/80 shrink-0">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              placeholder="Dán link ảnh vào đây..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSendImage(); if (e.key === "Escape") setImageOpen(false); }}
              className="h-10 rounded-xl bg-white border-primary/10 text-sm"
            />
            <button
              onClick={handleSendImage}
              disabled={!imageUrl.trim()}
              className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
            <button
              onClick={() => setImageOpen(false)}
              className="w-10 h-10 rounded-xl text-muted-foreground/50 hover:text-primary hover:bg-primary/5 flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1 pl-1">Hỗ trợ: jpg, png, gif, webp…</p>
        </div>
      )}

      {/* Emoji Picker */}
      {emojiOpen && (
        <div
          ref={emojiRef}
          className="border-t border-primary/5 bg-white/95 backdrop-blur-sm shrink-0"
          style={{ maxHeight: 230 }}
        >
          {/* Category tabs */}
          <div className="flex gap-0.5 px-3 pt-2 pb-1 overflow-x-auto">
            {EMOJI_CATEGORIES.map((cat, idx) => (
              <button
                key={idx}
                onClick={() => setEmojiTab(idx)}
                className={`flex-shrink-0 text-base px-2 py-1 rounded-xl transition-all ${emojiTab === idx ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5 text-muted-foreground/60'}`}
                title={cat.label}
              >
                {cat.icon}
              </button>
            ))}
          </div>
          {/* Emoji grid */}
          <div className="grid gap-0.5 px-3 pb-3 overflow-y-auto" style={{ gridTemplateColumns: "repeat(8, 1fr)", maxHeight: 160 }}>
            {EMOJI_CATEGORIES[emojiTab].emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertEmoji(emoji)}
                className="text-xl p-1.5 rounded-xl hover:bg-primary/10 transition-colors text-center leading-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="p-4 border-t border-primary/5 bg-white/60 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          {/* Emoji button */}
          <button
            type="button"
            onClick={() => { setEmojiOpen(o => !o); setImageOpen(false); }}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0 ${emojiOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground/50 hover:text-primary hover:bg-primary/5'}`}
            title="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Image button */}
          <button
            type="button"
            onClick={() => { setImageOpen(o => !o); setEmojiOpen(false); }}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0 ${imageOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground/50 hover:text-primary hover:bg-primary/5'}`}
            title="Gửi ảnh"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Gửi tin nhắn..."
            className="bg-white border-primary/10 focus-visible:ring-primary/20 h-12 rounded-2xl px-4 shadow-sm flex-1"
          />

          <Button
            type="submit"
            size="icon"
            disabled={!text.trim()}
            className="rounded-2xl w-12 h-12 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 shrink-0 transition-transform hover:scale-105 active:scale-95"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
