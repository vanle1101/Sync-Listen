import { useState, useRef, useEffect } from "react";
import { Track, ChatMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Smile, ImageIcon, X, Plus, Search, Loader2, Check, Trash2, Play, Music, Bell, BellOff } from "lucide-react";
import { useYoutubeSearch, getYoutubeSearchQueryKey } from "@workspace/api-client-react";

/* ── Emoji picker data ────────────────────────── */
const EMOJI_CATS = [
  { icon: "😊", emojis: ["😊","😂","🤣","😍","🥰","🤩","😘","😋","😎","🤗","😄","😁","😉","🥹","😭","😢","😤","😡","🤔","🤭","😴","🥱","😈","🤪","🤐","🫠","🥺","😏","😒","🤯","🫡"] },
  { icon: "❤️", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💕","💗","💓","💞","💖","💝","💘","♥️","🫶","💌","💟"] },
  { icon: "👍", emojis: ["👍","👎","👏","🙌","🤝","🙏","👋","🤞","✌️","🤟","🤙","💪","👌","🫶","🫂","🤜","🤛","🫰","🤌","👊"] },
  { icon: "🎵", emojis: ["🎵","🎶","🎸","🥁","🎹","🎻","🎺","🎷","🎤","🎧","📻","🎼","🎙️","🪗","🪘","🪕","🎚️","🎛️"] },
  { icon: "🌸", emojis: ["🌸","🌺","🌻","🌹","🍀","🦋","🐱","🐻","🌙","⭐","🌈","🎉","🎀","🎁","🎂","🍕","🧁","✨","💫","🌟","🔥","🌊","🍓","🌿","🫧","🪄","🦄","🍦","🧸"] },
];

const IMAGE_URL_RE = /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|svg|avif)(\?[^\s]*)?$/i;
function isImageUrl(t: string) { return IMAGE_URL_RE.test(t.trim()); }

function MessageContent({ text }: { text: string }) {
  if (isImageUrl(text)) return (
    <img src={text} alt="shared" className="max-w-[200px] rounded-2xl shadow-sm object-cover"
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
  );
  return <span className="whitespace-pre-wrap break-words">{text}</span>;
}

/* ── Activity item ────────────────────────── */
interface Activity { text: string; time: string; }

/* ── Props ─────────────────────────────────── */
interface RightPanelProps {
  playlist: Track[];
  currentTrack: Track | null;
  chatMessages: ChatMessage[];
  isHost: boolean;
  currentUser: string;
  onAddTrack: (t: Track) => void;
  onRemoveTrack: (i: number) => void;
  onPlayTrack: (i: number) => void;
  onSendMessage: (text: string) => void;
  activities: Activity[];
}

export function RightPanel({
  playlist, currentTrack, chatMessages, isHost, currentUser,
  onAddTrack, onRemoveTrack, onPlayTrack, onSendMessage, activities,
}: RightPanelProps) {
  const [tab, setTab] = useState<"playlist" | "chat" | "notif">("playlist");
  const [unreadChat, setUnreadChat] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const prevChatLen = useRef(chatMessages.length);

  useEffect(() => {
    if (chatMessages.length > prevChatLen.current && tab !== "chat") {
      setUnreadChat(u => u + (chatMessages.length - prevChatLen.current));
    }
    prevChatLen.current = chatMessages.length;
  }, [chatMessages.length, tab]);

  const handleTabChat = () => { setTab("chat"); setUnreadChat(0); };

  return (
    <div className="flex flex-col h-full bg-white/50 backdrop-blur-sm border-l border-primary/8 min-h-0">
      {/* Tabs */}
      <div className="flex items-center border-b border-primary/8 bg-white/60 shrink-0">
        <button
          onClick={() => setTab("playlist")}
          className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold tracking-wide transition-colors border-b-2 ${tab === "playlist" ? "border-primary text-primary" : "border-transparent text-muted-foreground/60 hover:text-primary/70"}`}
        >
          <Music className="w-3.5 h-3.5" />
          PLAYLIST
          <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">
            {(currentTrack ? 1 : 0) + playlist.length}
          </span>
        </button>
        <button
          onClick={handleTabChat}
          className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold tracking-wide transition-colors border-b-2 relative ${tab === "chat" ? "border-primary text-primary" : "border-transparent text-muted-foreground/60 hover:text-primary/70"}`}
        >
          CHAT
          {unreadChat > 0 && (
            <span className="absolute top-1.5 right-1 w-4 h-4 bg-primary text-white rounded-full text-[9px] font-bold flex items-center justify-center">{unreadChat}</span>
          )}
        </button>
        <button
          onClick={() => setTab("notif")}
          className={`flex items-center gap-1 px-3 py-3 text-xs font-semibold tracking-wide transition-colors border-b-2 ml-auto ${tab === "notif" ? "border-primary text-primary" : "border-transparent text-muted-foreground/60 hover:text-primary/70"}`}
        >
          {soundOn ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          <span className={soundOn ? "text-primary" : "text-muted-foreground/40"}>{soundOn ? "ON" : "OFF"}</span>
        </button>
      </div>

      {/* Tab content */}
      {tab === "playlist" && <PlaylistTab playlist={playlist} currentTrack={currentTrack} isHost={isHost} onAddTrack={onAddTrack} onRemoveTrack={onRemoveTrack} onPlayTrack={onPlayTrack} />}
      {tab === "chat" && <ChatTab messages={chatMessages} currentUser={currentUser} onSendMessage={onSendMessage} />}
      {tab === "notif" && <NotifTab activities={activities} soundOn={soundOn} onToggleSound={() => setSoundOn(s => !s)} />}
    </div>
  );
}

/* ── Playlist Tab ──────────────────────────── */
function PlaylistTab({ playlist, currentTrack, isHost, onAddTrack, onRemoveTrack, onPlayTrack }: {
  playlist: Track[]; currentTrack: Track | null; isHost: boolean;
  onAddTrack: (t: Track) => void; onRemoveTrack: (i: number) => void; onPlayTrack: (i: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"queue" | "search">("queue");

  const { data: results, isLoading } = useYoutubeSearch(
    { q: searchQuery },
    { query: { enabled: !!searchQuery, queryKey: getYoutubeSearchQueryKey({ q: searchQuery }) } }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) { setSearchQuery(query.trim()); setMode("search"); }
  };

  const handleAdd = (video: any) => {
    onAddTrack({ videoId: video.videoId, title: video.title, channelTitle: video.channelTitle, thumbnail: video.thumbnail, duration: video.duration });
    setAddedIds(prev => new Set([...prev, video.videoId]));
    setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(video.videoId); return n; }), 2000);
  };

  const clearSearch = () => { setQuery(""); setSearchQuery(""); setMode("queue"); };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search bar */}
      <div className="p-3 border-b border-primary/5 bg-white/40 shrink-0">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Dán link hoặc nhập tên bài hát..."
              className="pl-9 h-10 bg-white border-primary/10 rounded-2xl text-sm focus-visible:ring-primary/20 shadow-sm"
            />
          </div>
          <button
            type="submit"
            className="w-10 h-10 rounded-2xl bg-primary/10 hover:bg-primary text-primary hover:text-white flex items-center justify-center transition-all shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>
        {mode === "search" && (
          <button onClick={clearSearch} className="flex items-center gap-1 text-xs text-primary/60 hover:text-primary mt-2 pl-1 transition-colors">
            <X className="w-3 h-3" /> Về hàng đợi
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-2">
        {mode === "search" ? (
          isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-7 h-7 animate-spin text-primary/60" />
            </div>
          ) : results && results.length > 0 ? (
            <div className="space-y-1.5">
              {results.map((video) => (
                <div key={video.videoId} className="relative flex items-center gap-2.5 p-2.5 pr-14 rounded-2xl hover:bg-white border border-transparent hover:shadow-sm hover:border-primary/10 transition-all">
                  <img src={video.thumbnail} alt="" className="w-14 h-10 rounded-xl object-cover flex-shrink-0 bg-muted shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{video.title}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{video.channelTitle}</p>
                  </div>
                  <button
                    onClick={() => handleAdd(video)}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center transition-all border text-sm ${addedIds.has(video.videoId) ? 'bg-secondary border-secondary text-white' : 'border-primary/20 text-primary hover:bg-primary hover:text-white hover:border-primary'}`}
                  >
                    {addedIds.has(video.videoId) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <p className="text-center text-xs text-muted-foreground/50 p-8 italic">Không tìm thấy kết quả cho "{searchQuery}"</p>
          ) : null
        ) : (
          /* Queue */
          !currentTrack && playlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4 gap-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #fdf6f0, #fce8e8)' }}>
                <svg width="40" height="40" viewBox="0 0 110 110" fill="none" className="opacity-70">
                  <circle cx="55" cy="55" r="54" fill="#3d2b1f"/>
                  <circle cx="55" cy="55" r="38" fill="#2a1f14"/>
                  <circle cx="55" cy="55" r="8" fill="#c07060"/>
                  <circle cx="55" cy="55" r="3" fill="#f5e8e0"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground/60">Playlist trống</p>
                <p className="text-xs text-muted-foreground/40 mt-1">Chưa có bài hát nào được thêm vào Playlist.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {currentTrack && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-primary/5 border border-primary/20">
                  <div className="relative w-12 h-10 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-primary/25 flex items-center justify-center">
                      <div className="flex gap-0.5 items-end h-3.5">
                        {[4,2,5].map((h, i) => (
                          <span key={i} className="w-1 bg-white rounded-full animate-bounce" style={{ height: h*4, animationDelay: `${i*0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wide">▶ Đang phát</p>
                    <p className="text-xs font-semibold text-primary line-clamp-1 leading-snug mt-0.5">{currentTrack.title}</p>
                    <p className="text-[10px] text-muted-foreground/60">{currentTrack.channelTitle}</p>
                  </div>
                </div>
              )}
              {playlist.length > 0 && currentTrack && (
                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider px-1 pt-1">Tiếp theo</p>
              )}
              {playlist.map((track, i) => (
                <div key={`${track.videoId}-${i}`} className="group relative flex items-center gap-2.5 p-2.5 rounded-2xl hover:bg-white border border-transparent hover:shadow-sm hover:border-primary/10 transition-all"
                  style={{ paddingRight: isHost ? '5rem' : '0.75rem' }}>
                  <img src={track.thumbnail} alt="" className="w-12 h-10 rounded-xl object-cover flex-shrink-0 bg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{track.title}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{track.channelTitle}</p>
                  </div>
                  {isHost && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button onClick={() => onPlayTrack(i)} className="w-7 h-7 rounded-xl text-primary/60 hover:text-white hover:bg-primary flex items-center justify-center transition-all">
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button onClick={() => onRemoveTrack(i)} className="w-7 h-7 rounded-xl text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ── Chat Tab ──────────────────────────────── */
function ChatTab({ messages, currentUser, onSendMessage }: { messages: ChatMessage[]; currentUser: string; onSendMessage: (t: string) => void }) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!emojiOpen) return;
    const h = (e: MouseEvent) => { if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [emojiOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText(""); setEmojiOpen(false);
  };

  const insertEmoji = (emoji: string) => {
    const inp = inputRef.current;
    if (inp) {
      const s = inp.selectionStart ?? text.length;
      const end = inp.selectionEnd ?? text.length;
      setText(text.slice(0, s) + emoji + text.slice(end));
      setTimeout(() => { inp.focus(); inp.setSelectionRange(s + emoji.length, s + emoji.length); }, 0);
    } else setText(t => t + emoji);
  };

  const handleSendImage = () => {
    if (!imageUrl.trim()) return;
    onSendMessage(imageUrl.trim());
    setImageUrl(""); setImageOpen(false);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/50 gap-3 py-12">
            <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/40"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            </div>
            <p className="text-sm font-medium">Nói chào mọi người nhé!</p>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((msg, i) => {
              const isMe = msg.userName === currentUser;
              const date = new Date(msg.timestamp);
              const timeStr = isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className="flex items-baseline gap-1.5 mb-1 px-1">
                    <span className="text-[11px] font-semibold text-foreground/70">{msg.userName}</span>
                    <span className="text-[9px] text-muted-foreground/40">{timeStr}</span>
                  </div>
                  <div className={`${isImageUrl(msg.text) ? 'p-1' : 'px-4 py-2'} rounded-3xl max-w-[85%] text-sm shadow-sm ${isMe ? 'bg-gradient-to-br from-primary to-[#d4a0ab] text-white rounded-tr-none' : 'bg-white border border-primary/5 text-foreground rounded-tl-none'}`}>
                    <MessageContent text={msg.text} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {imageOpen && (
        <div className="px-3 py-2 border-t border-primary/5 bg-white/80 shrink-0">
          <div className="flex items-center gap-2">
            <Input autoFocus placeholder="Dán link ảnh vào đây..." value={imageUrl} onChange={e => setImageUrl(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSendImage(); if (e.key === "Escape") setImageOpen(false); }}
              className="h-9 rounded-xl bg-white border-primary/10 text-xs" />
            <button onClick={handleSendImage} disabled={!imageUrl.trim()} className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0">
              <Send className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setImageOpen(false)} className="w-9 h-9 rounded-xl text-muted-foreground/40 hover:text-primary hover:bg-primary/5 flex items-center justify-center transition-colors shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {emojiOpen && (
        <div ref={emojiRef} className="border-t border-primary/5 bg-white/95 shrink-0">
          <div className="flex gap-0.5 px-2 pt-2 pb-1">
            {EMOJI_CATS.map((cat, idx) => (
              <button key={idx} onClick={() => setEmojiTab(idx)}
                className={`text-base px-2 py-1 rounded-xl transition-all flex-shrink-0 ${emojiTab === idx ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5 text-muted-foreground/60'}`}>
                {cat.icon}
              </button>
            ))}
          </div>
          <div className="grid gap-0.5 px-2 pb-2 overflow-y-auto" style={{ gridTemplateColumns: "repeat(8, 1fr)", maxHeight: 140 }}>
            {EMOJI_CATS[emojiTab].emojis.map(emoji => (
              <button key={emoji} onClick={() => insertEmoji(emoji)} className="text-lg p-1 rounded-xl hover:bg-primary/10 transition-colors text-center leading-none">
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 border-t border-primary/5 bg-white/60 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-1.5 items-center">
          <button type="button" onClick={() => { setEmojiOpen(o => !o); setImageOpen(false); }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${emojiOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground/40 hover:text-primary hover:bg-primary/5'}`}>
            <Smile className="w-4.5 h-4.5" />
          </button>
          <button type="button" onClick={() => { setImageOpen(o => !o); setEmojiOpen(false); }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${imageOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground/40 hover:text-primary hover:bg-primary/5'}`}>
            <ImageIcon className="w-4.5 h-4.5" />
          </button>
          <Input ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder="Gửi tin nhắn..."
            className="bg-white border-primary/10 focus-visible:ring-primary/20 h-10 rounded-2xl px-4 shadow-sm flex-1 text-sm" />
          <button type="submit" disabled={!text.trim()}
            className="w-10 h-10 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20 shrink-0 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 flex items-center justify-center">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Notification / Activity Tab ────────────── */
function NotifTab({ activities, soundOn, onToggleSound }: { activities: Activity[]; soundOn: boolean; onToggleSound: () => void }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 gap-4">
      <div className="flex items-center justify-between p-3 bg-white/70 rounded-2xl border border-primary/10">
        <div className="flex items-center gap-2">
          {soundOn ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground/50" />}
          <div>
            <p className="text-sm font-medium text-foreground">Âm thanh thông báo</p>
            <p className="text-xs text-muted-foreground/60">Thông báo khi có người vào/thêm bài</p>
          </div>
        </div>
        <button onClick={onToggleSound}
          className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${soundOn ? 'bg-primary' : 'bg-muted'}`}>
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${soundOn ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">Hoạt động phòng</p>
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground/40 italic text-center py-6">Chưa có hoạt động nào</p>
        ) : (
          <div className="space-y-2 overflow-y-auto min-h-0">
            {activities.slice(-20).reverse().map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1 flex-shrink-0" />
                <span className="text-foreground/70 flex-1">{a.text}</span>
                <span className="text-muted-foreground/40 flex-shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
