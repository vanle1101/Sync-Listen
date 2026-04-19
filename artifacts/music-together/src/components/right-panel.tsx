import { useState, useRef, useEffect, useCallback } from "react";
import { Track, ChatMessage } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Send, Smile, X, Plus, Search, Loader2, Check, Trash2, Play, Bell, BellOff, Mic, MicOff, ImagePlus, ChevronDown, Music2 } from "lucide-react";
import { useYoutubeSearch, getYoutubeSearchQueryKey } from "@workspace/api-client-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

/* ─── helpers ──────────────────────────────────────── */
const IMAGE_URL_RE = /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|svg|avif)(\?[^\s]*)?$/i;
const isImageUrl = (t: string) => IMAGE_URL_RE.test(t.trim());
const isDataImage = (t: string) => t.startsWith("data:image/");
const isVoiceMsg = (t: string) => t.startsWith("[voice]");

async function compressImage(file: File, maxPx = 900): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = url;
  });
}

const SOUNDS = [
  { id: "ding",   icon: "🔔", label: "Chuông nhẹ" },
  { id: "pop",    icon: "💬", label: "Tin nhắn"   },
  { id: "chime",  icon: "🎵", label: "Nhạc nhẹ"   },
  { id: "silent", icon: "🔕", label: "Im lặng"     },
];

function playNotifSound(id: string) {
  if (id === "silent") return;
  try {
    const ctx = new AudioContext();
    const play = (freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.25) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type; osc.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur);
    };
    if (id === "ding")  { play(880, 0, 0.4); play(660, 0.05, 0.35); }
    if (id === "pop")   { play(400, 0, 0.12, "sine", 0.35); play(300, 0.05, 0.1, "sine", 0.2); }
    if (id === "chime") { play(523, 0, 0.7); play(659, 0.18, 0.6); play(784, 0.36, 0.55); }
  } catch { /* blocked */ }
}

/* ─── Message content ──────────────────────────────── */
function MessageContent({ text }: { text: string }) {
  if (isVoiceMsg(text)) {
    const src = text.slice(7);
    return (
      <div className="flex items-center gap-2 py-0.5">
        <Mic className="w-3.5 h-3.5 text-current opacity-70 shrink-0" />
        <audio controls src={src} className="h-7 max-w-[170px] opacity-90" style={{ filter: "invert(0)" }} />
      </div>
    );
  }
  if (isImageUrl(text) || isDataImage(text)) {
    return <img src={text} alt="shared" className="max-w-[200px] max-h-[200px] rounded-2xl shadow-sm object-cover"
      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />;
  }
  return <span className="whitespace-pre-wrap break-words">{text}</span>;
}

/* ─── Mini Avatar ──────────────────────────────────── */
function MiniAvatar({ name, url }: { name: string; url?: string }) {
  const initial = name.trim()[0]?.toUpperCase() || "?";
  return (
    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-primary/10 shadow-sm bg-gradient-to-br from-primary/10 to-secondary/20 flex items-center justify-center">
      {url
        ? <img src={url} alt={name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        : <span className="text-[10px] font-semibold text-primary/60">{initial}</span>}
    </div>
  );
}

/* ─── Sound picker dropdown ────────────────────────── */
function SoundPicker({ soundId, onChange }: { soundId: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SOUNDS.find(s => s.id === soundId) ?? SOUNDS[0];

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors
          ${soundId === "silent" ? "text-muted-foreground/40" : "text-primary border border-primary/30 bg-primary/5"}`}>
        {soundId === "silent" ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{soundId === "silent" ? "OFF" : "ON"}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-primary/10 rounded-2xl shadow-xl overflow-hidden min-w-[140px] animate-in fade-in zoom-in-95 duration-150">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground/50 px-3 pt-2.5 pb-1">CHUÔNG THÔNG BÁO</p>
          {SOUNDS.map(s => (
            <button key={s.id} onClick={() => { onChange(s.id); playNotifSound(s.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-primary/5 transition-colors
                ${soundId === s.id ? "text-primary font-semibold" : "text-foreground/70"}`}>
              <span className="text-base leading-none">{s.icon}</span>
              {s.label}
              {soundId === s.id && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Props ─────────────────────────────────────────── */
interface Activity { text: string; time: string; }
interface RightPanelProps {
  playlist: Track[];
  playedTracks: Track[];
  currentTrack: Track | null;
  chatMessages: ChatMessage[];
  isHost: boolean;
  currentUser: string;
  myAvatarUrl?: string;
  userAvatars?: Record<string, string>;
  onAddTrack: (t: Track) => void;
  onRemoveTrack: (i: number) => void;
  onPlayTrack: (i: number) => void;
  onSendMessage: (text: string) => void;
  activities: Activity[];
}

/* ─── RightPanel ────────────────────────────────────── */
export function RightPanel({
  playlist, playedTracks, currentTrack, chatMessages, isHost, currentUser,
  myAvatarUrl, userAvatars,
  onAddTrack, onRemoveTrack, onPlayTrack, onSendMessage, activities,
}: RightPanelProps) {
  const [tab, setTab] = useState<"playlist" | "chat">("playlist");
  const [unreadChat, setUnreadChat] = useState(0);
  const [soundId, setSoundId] = useState("ding");
  const prevChatLen = useRef(chatMessages.length);

  useEffect(() => {
    if (chatMessages.length > prevChatLen.current && tab !== "chat") {
      const delta = chatMessages.length - prevChatLen.current;
      setUnreadChat(u => u + delta);
      for (let i = 0; i < delta; i++) playNotifSound(soundId);
    }
    prevChatLen.current = chatMessages.length;
  }, [chatMessages.length, tab, soundId]);

  const handleTabChat = () => { setTab("chat"); setUnreadChat(0); };

  return (
    <div className="flex flex-col h-full bg-white/50 backdrop-blur-sm border-l border-primary/8 min-h-0">
      {/* ── Tab header ── */}
      <div className="flex items-center border-b border-primary/8 bg-white/60 shrink-0 px-1">
        <button onClick={() => setTab("playlist")}
          className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold tracking-wide transition-colors border-b-2
            ${tab === "playlist" ? "border-primary text-primary" : "border-transparent text-muted-foreground/60 hover:text-primary/70"}`}>
          <Music2 className="w-3.5 h-3.5" />
          PLAYLIST
          <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">
            {playedTracks.length + (currentTrack ? 1 : 0) + playlist.length}
          </span>
        </button>
        <button onClick={handleTabChat}
          className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold tracking-wide transition-colors border-b-2 relative
            ${tab === "chat" ? "border-primary text-primary" : "border-transparent text-muted-foreground/60 hover:text-primary/70"}`}>
          CHAT
          {unreadChat > 0 && (
            <span className="absolute top-1.5 right-0 w-4 h-4 bg-primary text-white rounded-full text-[9px] font-bold flex items-center justify-center">{unreadChat}</span>
          )}
        </button>
        <SoundPicker soundId={soundId} onChange={setSoundId} />
      </div>

      {/* ── Tab content ── */}
      {tab === "playlist"
        ? <PlaylistTab playlist={playlist} playedTracks={playedTracks} currentTrack={currentTrack} isHost={isHost} onAddTrack={onAddTrack} onRemoveTrack={onRemoveTrack} onPlayTrack={onPlayTrack} />
        : <ChatTab messages={chatMessages} currentUser={currentUser} myAvatarUrl={myAvatarUrl} userAvatars={userAvatars} onSendMessage={onSendMessage} />}
    </div>
  );
}

/* ─── Playlist Tab ──────────────────────────────────── */
function PlaylistTab({ playlist, playedTracks, currentTrack, isHost, onAddTrack, onRemoveTrack, onPlayTrack }: {
  playlist: Track[]; playedTracks: Track[]; currentTrack: Track | null; isHost: boolean;
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
      <div className="p-3 border-b border-primary/5 bg-white/40 shrink-0">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
            <Input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Dán link hoặc nhập tên bài hát..."
              className="pl-9 h-10 bg-white border-primary/10 rounded-2xl text-sm focus-visible:ring-primary/20 shadow-sm" />
          </div>
          <button type="submit"
            className="w-10 h-10 rounded-2xl bg-primary/10 hover:bg-primary text-primary hover:text-white flex items-center justify-center transition-all shrink-0">
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
              {results.map(video => (
                <div key={video.videoId} className="relative flex items-center gap-2.5 p-2.5 pr-14 rounded-2xl hover:bg-white border border-transparent hover:shadow-sm hover:border-primary/10 transition-all">
                  <img src={video.thumbnail} alt="" className="w-14 h-10 rounded-xl object-cover flex-shrink-0 bg-muted shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{video.title}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{video.channelTitle}</p>
                  </div>
                  <button onClick={() => handleAdd(video)}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center transition-all border text-sm
                      ${addedIds.has(video.videoId) ? "bg-secondary border-secondary text-white" : "border-primary/20 text-primary hover:bg-primary hover:text-white hover:border-primary"}`}>
                    {addedIds.has(video.videoId) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <p className="text-center text-xs text-muted-foreground/50 p-8 italic">Không tìm thấy "{searchQuery}"</p>
          ) : null
        ) : (
          !currentTrack && playlist.length === 0 && playedTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4 gap-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #fdf6f0, #fce8e8)" }}>
                <svg width="40" height="40" viewBox="0 0 110 110" fill="none">
                  <circle cx="55" cy="55" r="54" fill="#3d2b1f"/>
                  <circle cx="55" cy="55" r="38" fill="#2a1f14"/>
                  <circle cx="55" cy="55" r="8" fill="#c07060"/>
                  <circle cx="55" cy="55" r="3" fill="#f5e8e0"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground/60">Playlist trống</p>
                <p className="text-xs text-muted-foreground/40 mt-1">Chưa có bài hát nào được thêm.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {playedTracks.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider px-1 pt-1 flex items-center gap-1.5">
                    <span className="flex-1 h-px bg-muted-foreground/15 rounded" />Đã phát<span className="flex-1 h-px bg-muted-foreground/15 rounded" />
                  </p>
                  {playedTracks.map((track, i) => (
                    <div key={`played-${track.videoId}-${i}`} className="flex items-center gap-2.5 p-2.5 rounded-2xl opacity-40">
                      <div className="relative w-12 h-10 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={track.thumbnail} alt="" className="w-full h-full object-cover grayscale" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground/70 line-clamp-1">{track.title}</p>
                        <p className="text-[10px] text-muted-foreground/50">{track.channelTitle}</p>
                      </div>
                    </div>
                  ))}
                  {currentTrack && <div className="h-px bg-primary/10 mx-1" />}
                </>
              )}
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
                    <p className="text-xs font-semibold text-primary line-clamp-1">{currentTrack.title}</p>
                    <p className="text-[10px] text-muted-foreground/60">{currentTrack.channelTitle}</p>
                  </div>
                </div>
              )}
              {playlist.length > 0 && (
                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider px-1 pt-1">Tiếp theo</p>
              )}
              {playlist.map((track, i) => (
                <div key={`${track.videoId}-${i}`} className="group relative flex items-center gap-2.5 p-2.5 rounded-2xl hover:bg-white border border-transparent hover:shadow-sm hover:border-primary/10 transition-all"
                  style={{ paddingRight: isHost ? "5rem" : "0.75rem" }}>
                  <img src={track.thumbnail} alt="" className="w-12 h-10 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground line-clamp-2">{track.title}</p>
                    <p className="text-[10px] text-muted-foreground/60">{track.channelTitle}</p>
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

/* ─── Chat Tab ──────────────────────────────────────── */
function ChatTab({ messages, currentUser, myAvatarUrl, userAvatars, onSendMessage }: {
  messages: ChatMessage[]; currentUser: string;
  myAvatarUrl?: string; userAvatars?: Record<string, string>;
  onSendMessage: (t: string) => void;
}) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!emojiOpen) return;
    const h = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [emojiOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSendMessage(t);
    setText(""); setEmojiOpen(false);
  };

  const insertEmoji = (emoji: any) => {
    const native: string = emoji.native ?? emoji.unified ?? "";
    const inp = inputRef.current;
    if (inp) {
      const s = inp.selectionStart ?? text.length;
      const end = inp.selectionEnd ?? text.length;
      const next = text.slice(0, s) + native + text.slice(end);
      setText(next);
      setTimeout(() => { inp.focus(); inp.setSelectionRange(s + native.length, s + native.length); }, 0);
    } else {
      setText(t => t + native);
    }
  };

  const handleFileImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const dataUrl = await compressImage(file);
      onSendMessage(dataUrl);
    } catch { /* ignore */ }
  }, [onSendMessage]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => onSendMessage(`[voice]${reader.result}`);
        reader.readAsDataURL(blob);
      };
      mr.start();
      mediaRecRef.current = mr;
      setIsRecording(true);
      setRecSec(0);
      recTimerRef.current = setInterval(() => setRecSec(s => s + 1), 1000);
    } catch {
      alert("Không thể truy cập microphone. Kiểm tra quyền trình duyệt.");
    }
  };

  const stopRecording = (send = true) => {
    if (!send && mediaRecRef.current) {
      chunksRef.current = [];
      mediaRecRef.current.stream?.getTracks().forEach(t => t.stop());
    }
    mediaRecRef.current?.stop();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setIsRecording(false);
  };

  const fmtSec = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8 select-none">
            {/* Cute chat bubble SVG */}
            <div className="w-36 h-36 rounded-3xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fdf6f0, #fce8e8)" }}>
              <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                {/* back bubble */}
                <rect x="30" y="28" width="52" height="38" rx="16" fill="#8B5E52"/>
                <circle cx="46" cy="50" r="3" fill="#ffb3c1"/>
                <circle cx="57" cy="45" r="3" fill="#ffb3c1"/>
                <circle cx="68" cy="50" r="3" fill="#ffb3c1"/>
                <polygon points="34,64 28,74 44,64" fill="#8B5E52"/>
                {/* front bubble */}
                <rect x="8" y="18" width="50" height="36" rx="14" fill="#C47B6A"/>
                <circle cx="21" cy="34" r="3.5" fill="#ffe0d0"/>
                <circle cx="33" cy="34" r="3.5" fill="#ffe0d0"/>
                <circle cx="45" cy="34" r="3.5" fill="#ffe0d0"/>
                <polygon points="52,52 62,62 38,52" fill="#C47B6A"/>
                {/* Hearts */}
                <text x="14" y="20" fontSize="9" fill="#ff8fa3">♥</text>
                <text x="54" y="26" fontSize="7" fill="#ffb3c1">♥</text>
                <text x="65" y="65" fontSize="8" fill="#C47B6A">♥</text>
                {/* Sparkles */}
                <text x="4" y="14" fontSize="7" fill="#f5c0b0">✦</text>
                <text x="74" y="20" fontSize="6" fill="#c0a0a0">✦</text>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground/70">Chưa có tin nhắn nào</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Hãy là người đầu tiên bắt đầu cuộc trò chuyện!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => {
              const isMe = msg.userName === currentUser;
              const date = new Date(msg.timestamp);
              const timeStr = isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const avatarUrl = isMe ? myAvatarUrl : userAvatars?.[msg.userName];
              const showName = !messages[i - 1] || messages[i - 1].userName !== msg.userName;
              return (
                <div key={i} className={`flex ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className="flex-shrink-0 self-end">
                    {showName ? <MiniAvatar name={msg.userName} url={avatarUrl} /> : <div className="w-7" />}
                  </div>
                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[78%]`}>
                    {showName && (
                      <div className={`flex items-baseline gap-1.5 mb-1 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
                        <span className="text-[11px] font-semibold text-foreground/70">{isMe ? "Bạn" : msg.userName}</span>
                        <span className="text-[9px] text-muted-foreground/40">{timeStr}</span>
                      </div>
                    )}
                    <div className={`${isImageUrl(msg.text) || isDataImage(msg.text) ? "p-1" : "px-4 py-2.5"} rounded-3xl text-sm shadow-sm
                      ${isMe ? "bg-gradient-to-br from-primary to-[#d4a0ab] text-white rounded-br-md" : "bg-white border border-primary/5 text-foreground rounded-bl-md"}`}>
                      <MessageContent text={msg.text} />
                      {!showName && <span className="ml-2 text-[8px] opacity-50">{timeStr}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recording indicator ── */}
      {isRecording && (
        <div className="mx-3 mb-1 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-2xl shrink-0 animate-in fade-in duration-200">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
          <span className="text-xs font-medium text-red-600 flex-1">Đang ghi âm... {fmtSec(recSec)}</span>
          <button onClick={() => stopRecording(true)}
            className="text-xs font-semibold text-white bg-red-500 px-3 py-1 rounded-xl hover:bg-red-600 transition-colors">Gửi</button>
          <button onClick={() => stopRecording(false)}
            className="text-xs text-red-400 hover:text-red-600 transition-colors">Hủy</button>
        </div>
      )}

      {/* ── Emoji picker ── */}
      {emojiOpen && (
        <div ref={emojiRef} className="border-t border-primary/5 shrink-0 emoji-picker-wrapper">
          <Picker data={data} set="facebook" theme="light" locale="vi"
            previewPosition="none" skinTonePosition="none" navPosition="bottom" perLine={8}
            onEmojiSelect={insertEmoji}
            style={{ width: "100%", border: "none", borderRadius: 0, boxShadow: "none" }} />
        </div>
      )}

      {/* ── Input toolbar ── */}
      <div className="p-3 border-t border-primary/5 bg-white/60 shrink-0">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileImage} />
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          {/* Image upload */}
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 text-muted-foreground/50 hover:text-primary hover:bg-primary/8">
            <ImagePlus className="w-4.5 h-4.5" />
          </button>

          {/* Emoji */}
          <button type="button" onClick={() => setEmojiOpen(o => !o)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0
              ${emojiOpen ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-primary hover:bg-primary/8"}`}>
            <Smile className="w-4.5 h-4.5" />
          </button>

          {/* Text input */}
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1 h-10 bg-white border border-primary/10 rounded-2xl px-4 text-sm focus:outline-none focus:border-primary/40 shadow-sm" />

          {/* Send / Mic */}
          {text.trim() ? (
            <button type="submit"
              className="w-10 h-10 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20 shrink-0 transition-all hover:scale-105 active:scale-95 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={() => isRecording ? stopRecording(true) : startRecording()}
              className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center transition-all hover:scale-105 active:scale-95
                ${isRecording ? "bg-red-500 text-white shadow-md shadow-red-200 animate-pulse" : "bg-primary/10 text-primary hover:bg-primary hover:text-white"}`}>
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
