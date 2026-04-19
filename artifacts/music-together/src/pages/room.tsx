import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useWebSocket } from "@/hooks/use-websocket";
import { Track, ChatMessage } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { YoutubePlayer } from "@/components/youtube-player";
import { PlayerControls } from "@/components/player-controls";
import { RightPanel } from "@/components/right-panel";
import {
  Music, Loader2, Copy, LogOut, Minimize2, Maximize2, Share2, CreditCard,
  Palette, Coffee, Settings, Globe, Users, X, Download, Check, Heart, ImagePlus, Power, Lock, Eye, EyeOff,
  MessageCircle, Send, ChevronDown, Play, Pause, SkipForward
} from "lucide-react";
import { useGetRoom, getGetRoomQueryKey } from "@workspace/api-client-react";

/* ──────────────── helpers ──────────────── */
function saveRecentRoom(roomId: string, hostName: string) {
  try {
    const key = "music-together-rooms";
    const raw = localStorage.getItem(key);
    const rooms: { id: string; hostName: string; visitedAt: number }[] = raw ? JSON.parse(raw) : [];
    const filtered = rooms.filter(r => r.id !== roomId);
    filtered.unshift({ id: roomId, hostName, visitedAt: Date.now() });
    localStorage.setItem(key, JSON.stringify(filtered.slice(0, 8)));
  } catch {}
}

function nowTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

/* ──────────────── Themes ──────────────── */
const THEMES = [
  { id: "cream",    emoji: "☕", name: "Cream",    colors: ["#fdf6f0","#c07080","#7a9e7e"], bg: "from-[#fdf6f0] via-[#fce8e8] to-[#eef5ef]" },
  { id: "midnight", emoji: "🌙", name: "Midnight",  colors: ["#1e1b2e","#8b7dff","#5eead4"], bg: "from-[#1e1b2e] via-[#2d1b3d] to-[#1a2e2a]" },
  { id: "sakura",   emoji: "🌸", name: "Sakura",    colors: ["#fff0f5","#e87090","#f8b8c8"], bg: "from-[#fff0f5] via-[#fce0ec] to-[#fef0f8]" },
  { id: "ocean",    emoji: "🌊", name: "Ocean",     colors: ["#eef4f8","#2d7dd2","#2da88e"], bg: "from-[#eef4f8] via-[#ddeef8] to-[#e0f5f0]" },
  { id: "forest",   emoji: "🌿", name: "Forest",    colors: ["#eef4ee","#4a7c59","#8b7355"], bg: "from-[#eef4ee] via-[#ddeedd] to-[#f5f0e8]" },
  { id: "sunset",   emoji: "🌅", name: "Sunset",    colors: ["#fff4e0","#e86030","#f0a020"], bg: "from-[#fff4e0] via-[#ffe0c0] to-[#fff0e8]" },
  { id: "neon",     emoji: "💜", name: "Neon",      colors: ["#1a0a2e","#b060ff","#ff60d0"], bg: "from-[#1a0a2e] via-[#2a0a40] to-[#1a1a3e]" },
  { id: "arctic",   emoji: "❄️", name: "Arctic",    colors: ["#eef8fc","#40b0e0","#80d0f0"], bg: "from-[#eef8fc] via-[#ddeef8] to-[#e8f4fc]" },
];

/* ──────────────── FullscreenChat ──────────────── */
const IMAGE_URL_RE_FS = /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|svg|avif)(\?[^\s]*)?$/i;

function FullscreenChat({
  messages, currentUser, myAvatarUrl, userAvatars, onSendMessage, onMinimize, onClose,
}: {
  messages: ChatMessage[]; currentUser: string; myAvatarUrl?: string;
  userAvatars?: Record<string, string>; onSendMessage: (t: string) => void;
  onMinimize: () => void; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim(); if (!t) return;
    onSendMessage(t); setText("");
  };

  return (
    <div className="w-[300px] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-white/20" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0 border-b border-black/5" style={{ background: "rgba(192,112,128,0.12)" }}>
        <MessageCircle className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground/80 flex-1">Phòng chat</span>
        <button onClick={onMinimize} title="Thu nhỏ" className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:bg-black/8 hover:text-primary transition-colors">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button onClick={onClose} title="Đóng" className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:bg-red-50 hover:text-red-500 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="overflow-y-auto min-h-0 p-3 space-y-2" style={{ maxHeight: 340 }}>
        {messages.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground/50">Chưa có tin nhắn nào</div>
        ) : messages.map((msg, i) => {
          const isMe = msg.userName === currentUser;
          const avatarUrl = isMe ? myAvatarUrl : userAvatars?.[msg.userName];
          const showName = i === 0 || messages[i - 1].userName !== msg.userName;
          const isImg = IMAGE_URL_RE_FS.test(msg.text.trim()) || msg.text.startsWith("data:image/");
          const isVoice = msg.text.startsWith("[voice]");
          return (
            <div key={i} className={`flex ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-1.5`}>
              <div className="shrink-0">
                {showName ? (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden shadow-sm"
                    style={{ background: avatarUrl ? "transparent" : "linear-gradient(135deg,#c07080,#7a9e7e)" }}>
                    {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : msg.userName[0]?.toUpperCase()}
                  </div>
                ) : <div className="w-6" />}
              </div>
              <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                {showName && !isMe && <span className="text-[9px] font-semibold text-foreground/50 mb-0.5 px-1">{msg.userName}</span>}
                <div className={`rounded-2xl text-xs shadow-sm ${isImg ? "p-1" : "px-3 py-1.5"} ${isMe ? "bg-gradient-to-br from-primary to-[#d4a0ab] text-white rounded-br-sm" : "bg-gray-100 text-foreground rounded-bl-sm"}`}>
                  {isImg ? (
                    <img src={msg.text} alt="" className="rounded-xl max-w-[180px] max-h-[180px] object-cover" />
                  ) : isVoice ? (
                    <span className="opacity-70 italic">🎤 Tin nhắn thoại</span>
                  ) : msg.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={submit} className="flex items-center gap-1.5 p-2 border-t border-black/5 shrink-0">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Nhắn gì đó..."
          className="flex-1 h-8 bg-gray-50 border border-primary/10 rounded-xl px-3 text-xs focus:outline-none focus:border-primary/40" />
        <button type="submit" disabled={!text.trim()}
          className="w-8 h-8 rounded-xl bg-primary hover:bg-primary/90 text-white disabled:opacity-30 flex items-center justify-center transition-all shrink-0">
          <Send className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
}

/* ──────────────── WaitingIllustration ──────────────── */
function WaitingIllustration() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden select-none px-8">
      {/* Watermark left */}
      <div className="absolute left-0 top-0 bottom-0 flex items-center pl-4 opacity-10 pointer-events-none">
        <svg viewBox="0 0 120 200" width="120" height="200" className="text-primary fill-current">
          <text x="10" y="80" fontSize="90" fontFamily="serif">𝄞</text>
          <text x="20" y="140" fontSize="35">♩</text>
          <text x="60" y="170" fontSize="30">♫</text>
          <text x="5" y="185" fontSize="28">♪</text>
        </svg>
      </div>
      {/* Watermark right */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center pr-4 opacity-8 pointer-events-none">
        <svg viewBox="0 0 140 140" width="140" height="140">
          <ellipse cx="70" cy="95" rx="55" ry="30" fill="none" stroke="currentColor" strokeWidth="14" className="text-primary/20"/>
          <rect x="15" y="35" width="110" height="60" rx="55" fill="none" stroke="currentColor" strokeWidth="14" className="text-primary/20"/>
          <circle cx="25" cy="90" r="18" fill="currentColor" className="text-primary/20"/>
          <circle cx="115" cy="90" r="18" fill="currentColor" className="text-primary/20"/>
        </svg>
      </div>

      {/* Center illustration */}
      <div className="relative flex flex-col items-center gap-6 z-10">
        {/* Record player in circle */}
        <div className="w-44 h-44 rounded-full flex items-center justify-center shadow-2xl relative"
          style={{ background: 'radial-gradient(circle at 40% 35%, #fdf0e0, #f5d8c0)' }}>
          {/* Record player body */}
          <div className="relative">
            <div className="w-24 h-20 rounded-2xl shadow-md flex items-end justify-center pb-2"
              style={{ background: 'linear-gradient(145deg, #c87050, #a05030)' }}>
              {/* Platter */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2">
                <svg width="56" height="56" viewBox="0 0 56 56" className="animate-[spin_4s_linear_infinite]">
                  <circle cx="28" cy="28" r="27" fill="#1a0f0a"/>
                  <circle cx="28" cy="28" r="19" fill="#140c07"/>
                  <circle cx="28" cy="28" r="10" fill="#160d08"/>
                  <circle cx="28" cy="28" r="4" fill="#c07060"/>
                  <circle cx="28" cy="28" r="1.5" fill="#f5e0d0"/>
                  <path d="M6 28 Q28 4 50 28" stroke="rgba(255,255,255,0.05)" strokeWidth="5" fill="none"/>
                </svg>
              </div>
              {/* Tone arm */}
              <div className="absolute top-4 right-3 w-0.5 h-10 rounded-full origin-top"
                style={{ background: '#d4a060', transform: 'rotate(20deg)' }} />
              {/* Feet */}
              <div className="flex gap-6">
                <div className="w-2 h-2 rounded-full bg-[#7a4020]" />
                <div className="w-2 h-2 rounded-full bg-[#7a4020]" />
              </div>
            </div>
            {/* Music notes floating */}
            <div className="absolute -top-6 -right-8 text-2xl animate-bounce" style={{ animationDuration: '2.5s', color: '#c07080' }}>♪</div>
            <div className="absolute -top-8 right-0 text-xl animate-bounce" style={{ animationDuration: '3s', animationDelay: '0.5s', color: '#7a9e7e' }}>♫</div>
            <div className="absolute -top-4 -left-8 text-lg animate-bounce" style={{ animationDuration: '2.8s', animationDelay: '1s', color: '#c07080' }}>♩</div>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-serif italic font-semibold text-foreground/80">Không gian chờ</h2>
          <p className="text-sm text-muted-foreground/60 mt-2 max-w-xs leading-relaxed">
            Host chưa phát bài nào. Hãy thư giãn hoặc yêu cầu bài hát bên cột phải nhé!
          </p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Share Modal ──────────────── */
function ShareModal({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/room/${roomId}`;
  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <ModalBase title="Chia sẻ phòng" onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-4">Gửi link này để mời bạn bè cùng nghe nhạc</p>
      <div className="flex gap-2">
        <div className="flex-1 bg-primary/5 border border-primary/10 rounded-2xl px-4 py-3 text-sm font-mono text-foreground/70 truncate">{link}</div>
        <button onClick={copy} className={`px-4 py-3 rounded-2xl text-sm font-medium transition-all flex items-center gap-2 ${copied ? 'bg-secondary text-white' : 'bg-primary text-white hover:bg-primary/90'}`}>
          {copied ? <><Check className="w-4 h-4" /> Đã sao chép</> : <><Copy className="w-4 h-4" /> Sao chép</>}
        </button>
      </div>
      <div className="mt-4 p-4 bg-primary/5 rounded-2xl text-center">
        <p className="text-xs text-muted-foreground/60 mb-1">Mã phòng</p>
        <p className="text-3xl font-mono font-bold tracking-[0.3em] text-primary">{roomId}</p>
      </div>
    </ModalBase>
  );
}

/* ──────────────── Postcard Modal ──────────────── */
function PostcardModal({
  roomId, hostName, currentTrack, listeners, onClose,
}: {
  roomId: string; hostName: string; currentTrack: Track | null;
  listeners: string[]; onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [shared, setShared] = useState(false);
  const joinUrl = `${window.location.origin}/room/${roomId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(joinUrl)}&bgcolor=fdf6f0&color=3d1a1a&format=png&margin=6&qzone=1`;

  const download = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `music-together-${roomId}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const share = async () => {
    const text = `🎵 Cùng nghe nhạc tại phòng của ${hostName}!\nMã phòng: ${roomId}\n${joinUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Music Together", text, url: joinUrl }); setShared(true); setTimeout(() => setShared(false), 2000); }
      catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      setShared(true); setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <ModalBase title="Bưu thiếp phòng" onClose={onClose}>
      {/* ── Card ── */}
      <div ref={cardRef}
        style={{ background: "#fdf6f0", fontFamily: "serif" }}
        className="rounded-2xl border border-rose-200 overflow-hidden shadow-sm">
        {/* header */}
        <div className="px-5 pt-5 pb-3">
          <p style={{ color: "#c07080", fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>Music Together</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#2d1010", marginTop: 2 }}>{hostName}</p>
        </div>
        {/* body */}
        <div className="px-5 pb-5 flex gap-4 items-start">
          {/* left info */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div>
              <p style={{ color: "#c07080", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>♫ ĐANG PHÁT</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#2d1010", marginTop: 2, lineHeight: 1.3 }} className="line-clamp-2">
                {currentTrack ? currentTrack.title : "Chưa có bài nào"}
              </p>
            </div>
            <div>
              <p style={{ color: "#6b3030", fontSize: 13 }}>{listeners.length} người nghe</p>
              <div style={{ marginTop: 2 }}>
                {listeners.slice(0, 5).map(l => (
                  <p key={l} style={{ color: "#6b3030", fontSize: 13 }}>{l}</p>
                ))}
                {listeners.length > 5 && <p style={{ color: "#a07080", fontSize: 12 }}>+{listeners.length - 5} người khác</p>}
              </div>
            </div>
            <div>
              <p style={{ color: "#c07080", fontSize: 13, fontWeight: 700 }}>Mã phòng: {roomId}</p>
              <p style={{ color: "#a07080", fontSize: 11, marginTop: 1, wordBreak: "break-all" }}>{joinUrl}</p>
            </div>
          </div>
          {/* QR code */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <img src={qrUrl} alt="QR" width={110} height={110}
              style={{ borderRadius: 8, border: "1px solid rgba(192,112,128,0.2)" }} />
            <p style={{ color: "#a07080", fontSize: 10 }}>Scan to join</p>
          </div>
        </div>
        {/* footer */}
        <div style={{ background: "rgba(192,112,128,0.06)", borderTop: "1px solid rgba(192,112,128,0.15)" }}
          className="px-5 py-3">
          <p style={{ color: "#a07080", fontSize: 11 }}>Made with Music Together ♫ Cùng nghe nhạc, mọi lúc mọi nơi</p>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="mt-4 flex gap-3">
        <button onClick={download} disabled={downloading}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-background border border-primary/20 text-foreground rounded-2xl font-medium text-sm hover:bg-primary/5 transition-colors disabled:opacity-60">
          <Download className="w-4 h-4" />
          {downloading ? "Đang tải..." : "Tải xuống"}
        </button>
        <button onClick={share}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-2xl font-medium text-sm hover:bg-primary/90 transition-colors">
          {shared ? <><Check className="w-4 h-4" /> Đã chia sẻ!</> : <><Share2 className="w-4 h-4" /> Chia sẻ</>}
        </button>
      </div>
    </ModalBase>
  );
}

/* ──────────────── Theme Modal ──────────────── */
function ThemeModal({
  currentTheme, onSelect, bgImageUrl, onSetBgImage, onClose,
}: {
  currentTheme: string; onSelect: (id: string) => void;
  bgImageUrl: string; onSetBgImage: (url: string) => void; onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      onSetBgImage(url);
    };
    reader.readAsDataURL(file);
  };

  return (
    <ModalBase title="Giao diện phòng" onClose={onClose}>
      {/* Theme grid 4-col */}
      <div className="grid grid-cols-4 gap-2.5">
        {THEMES.map(t => {
          const active = currentTheme === t.id && !bgImageUrl;
          return (
            <button key={t.id}
              onClick={() => { onSelect(t.id); onSetBgImage(""); }}
              className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95
                ${active ? 'border-primary shadow-md bg-primary/5' : 'border-border/60 hover:border-primary/40 bg-white/60'}`}>
              <span className="text-2xl leading-none">{t.emoji}</span>
              <span className="text-[11px] font-medium text-foreground/70">{t.name}</span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="my-4 border-t border-border/40" />

      {/* Background image upload */}
      <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 mb-3">ẢNH NỀN</p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {bgImageUrl ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-primary shadow-md">
          <img src={bgImageUrl} alt="bg" className="w-full h-24 object-cover" />
          <button onClick={() => onSetBgImage("")}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/50 text-white text-[10px] hover:bg-black/70 transition-colors">
            Đổi ảnh
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()}
          className="w-full flex flex-col items-center gap-2 py-5 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/3 transition-all text-muted-foreground/60 hover:text-primary/70">
          <ImagePlus className="w-6 h-6" />
          <span className="text-sm">Tải ảnh lên</span>
        </button>
      )}
    </ModalBase>
  );
}

/* ──────────────── Settings Modal ──────────────── */
function SettingsModal({
  roomId, hostName, listeners, isHost,
  themeId, onSelectTheme,
  onClose,
}: {
  roomId: string; hostName: string; listeners: string[];
  isHost: boolean; themeId: string; onSelectTheme: (id: string) => void;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [roomName, setRoomName] = useState(hostName);
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [localTheme, setLocalTheme] = useState(themeId);
  const [closeConfirm, setCloseConfirm] = useState(false);

  const handleSave = () => {
    onSelectTheme(localTheme);
    toast({ title: "Đã lưu cài đặt" });
    onClose();
  };

  const handleCloseRoom = () => {
    if (!closeConfirm) { setCloseConfirm(true); return; }
    toast({ title: "Phòng đã đóng", description: "Tạm biệt nhé!" });
    setLocation("/");
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 mb-2">{children}</p>
  );

  return (
    <ModalBase title="Cài đặt phòng" onClose={onClose} scrollable>
      <div className="space-y-5">
        {/* Room name */}
        <div>
          <SectionLabel>TÊN PHÒNG</SectionLabel>
          <input
            value={roomName}
            onChange={e => setRoomName(e.target.value)}
            disabled={!isHost}
            className="w-full px-4 py-3 rounded-2xl border border-border/60 bg-background/60 text-sm text-foreground focus:outline-none focus:border-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Tên phòng..."
          />
        </div>

        {/* Public toggle */}
        <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-border/60 bg-background/40">
          <Globe className="w-5 h-5 text-muted-foreground/60 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Phòng công khai</p>
            <p className="text-xs text-muted-foreground/60">Chỉ có link mới vào được</p>
          </div>
          <button
            onClick={() => isHost && setIsPublic(p => !p)}
            disabled={!isHost}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isPublic ? 'bg-primary' : 'bg-border'} disabled:opacity-50`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Password */}
        <div>
          <SectionLabel>MẬT KHẨU PHÒNG <span className="normal-case font-normal opacity-60">(tùy chọn)</span></SectionLabel>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={!isHost}
              placeholder={isHost ? "••••• (nhập để đặt, bỏ trống để xóa)" : "•••••"}
              className="w-full pl-10 pr-10 py-3 rounded-2xl border border-border/60 bg-background/60 text-sm text-foreground focus:outline-none focus:border-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button onClick={() => setShowPass(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-muted-foreground/40 hover:text-primary transition-colors">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Theme picker */}
        <div>
          <SectionLabel>GIAO DIỆN PHÒNG</SectionLabel>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map(t => (
              <button key={t.id}
                onClick={() => setLocalTheme(t.id)}
                className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95
                  ${localTheme === t.id ? 'border-primary shadow-md bg-primary/5' : 'border-border/50 hover:border-primary/40 bg-white/60'}`}>
                <span className="text-2xl leading-none">{t.emoji}</span>
                <span className="text-[11px] font-medium text-foreground/70">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <button onClick={handleSave}
          className="w-full py-3.5 bg-primary text-white rounded-2xl font-semibold text-sm hover:bg-primary/90 transition-colors">
          Lưu thay đổi
        </button>

        {/* Close room — host only */}
        {isHost && (
          <button onClick={handleCloseRoom}
            className={`w-full py-3.5 rounded-2xl font-semibold text-sm border-2 transition-all flex items-center justify-center gap-2
              ${closeConfirm
                ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                : 'text-red-500 border-red-200 hover:bg-red-50'}`}>
            <Power className="w-4 h-4" />
            {closeConfirm ? "Xác nhận đóng phòng?" : "Đóng phòng vĩnh viễn"}
          </button>
        )}

        {/* Room info footer */}
        <div className="text-center text-xs text-muted-foreground/40 pt-1">
          Mã phòng: <span className="font-mono font-bold tracking-wider">{roomId}</span>
          {" · "}{listeners.length} người nghe
        </div>
      </div>
    </ModalBase>
  );
}

/* ──────────────── Modal Base ──────────────── */
function ModalBase({ title, children, onClose, scrollable = false }: {
  title: string; children: React.ReactNode; onClose: () => void; scrollable?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-white/95 rounded-3xl shadow-2xl w-full max-w-md relative animate-in zoom-in-95 duration-200 flex flex-col ${scrollable ? 'max-h-[90vh]' : ''}`}>
        <div className="flex items-center justify-between px-6 pt-6 pb-5 shrink-0">
          <h2 className="text-lg font-serif italic font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-primary/10 flex items-center justify-center text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={`px-6 pb-6 ${scrollable ? 'overflow-y-auto min-h-0' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Toolbar Button ──────────────── */
function ToolBtn({ icon: Icon, label, shortLabel, onClick, active = false, accent = false, disabled = false }: {
  icon: any; label: string; shortLabel?: string; onClick: () => void; active?: boolean; accent?: boolean; disabled?: boolean;
}) {
  const text = shortLabel ?? label;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-medium transition-all select-none shrink-0 whitespace-nowrap
        ${accent
          ? 'bg-[#e87040] hover:bg-[#cf5e30] text-white shadow-sm'
          : active
          ? 'bg-primary/12 text-primary border border-primary/20'
          : 'text-foreground/55 hover:bg-primary/8 hover:text-primary'}
        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="hidden sm:inline">{text}</span>
    </button>
  );
}

/* ──────────────── Donate Modal ──────────────── */
function DonateModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const stk = "1020334219";
  const bank = "VCB";
  const owner = "LE HONG VAN";
  const qrUrl = `https://img.vietqr.io/image/${bank}-${stk}-compact2.png?amount=0&addInfo=Music%20Together&accountName=${encodeURIComponent(owner)}`;

  const copySTK = () => {
    navigator.clipboard.writeText(stk).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <ModalBase title="☕ Mời một tách cafe" onClose={onClose}>
      <p className="text-sm text-muted-foreground text-center mb-5">
        Nếu thấy app hay, bạn có thể ủng hộ mình một tách cafe nhé!
      </p>
      {/* QR code */}
      <div className="flex justify-center mb-5">
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-primary/10">
          <img
            src={qrUrl}
            alt="VietQR"
            className="w-44 h-44 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      </div>
      {/* Bank info */}
      <div className="bg-white/60 rounded-2xl border border-primary/10 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, #007B40, #00a550)' }}>
            VCB
          </div>
          <div>
            <p className="text-xs text-muted-foreground/50 uppercase tracking-wide">Ngân hàng</p>
            <p className="text-sm font-semibold text-foreground">Vietcombank</p>
          </div>
        </div>
        <div className="flex items-center justify-between bg-primary/3 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide mb-0.5">Số tài khoản</p>
            <p className="text-base font-mono font-bold text-foreground tracking-wider">{stk}</p>
          </div>
          <button
            onClick={copySTK}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-xs font-medium transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Đã copy" : "Copy"}
          </button>
        </div>
        <div className="px-1">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide mb-0.5">Chủ tài khoản</p>
          <p className="text-sm font-semibold text-foreground">{owner}</p>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground/40 mt-4">Nội dung CK: <span className="font-medium">Music Together</span></p>
    </ModalBase>
  );
}

/* ──────────────── Main Room Page ──────────────── */
export default function Room() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoaded: clerkLoaded } = useUser();

  const [userName, setUserName] = useState<string | null>(null);
  const [volume, setVolume] = useState(80);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);

  // Toolbar state
  const [compact, setCompact] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsChatOpen, setFsChatOpen] = useState(false);
  const [fsChatMinimized, setFsChatMinimized] = useState(false);
  const [fsUnread, setFsUnread] = useState(0);
  const prevChatLenRef = useRef(0);
  const [hostActive, setHostActive] = useState(true);
  const [themeId, setThemeId] = useState("cream");
  const [bgImageUrl, setBgImageUrl] = useState<string>(() => {
    try { return localStorage.getItem("music-together-bg") ?? ""; } catch { return ""; }
  });
  const handleSetBgImage = (url: string) => {
    setBgImageUrl(url);
    try {
      if (url) localStorage.setItem("music-together-bg", url);
      else localStorage.removeItem("music-together-bg");
    } catch { /* quota exceeded */ }
  };

  // Modal state
  const [shareOpen, setShareOpen] = useState(false);
  const [postcardOpen, setPostcardOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);

  // Activity log
  const [activities, setActivities] = useState<{ text: string; time: string }[]>([]);

  const addActivity = useCallback((text: string) => {
    setActivities(a => [...a, { text, time: nowTime() }]);
  }, []);

  const [myAvatarUrl, setMyAvatarUrl] = useState<string>("");
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!clerkLoaded) return;
    if (user) {
      // Signed in with Clerk — use their name and avatar
      const clerkName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.emailAddresses[0]?.emailAddress || "Khách";
      setUserName(clerkName);
      if (user.imageUrl) setMyAvatarUrl(user.imageUrl);
    } else {
      // Guest — read from localStorage (persisted) or sessionStorage (fallback)
      const name = localStorage.getItem("music-together-name")
        ?? sessionStorage.getItem("music-together-name");
      if (!name) { setLocation("/"); return; }
      setUserName(name);
      const av = localStorage.getItem("music-together-avatar")
        ?? sessionStorage.getItem("music-together-avatar");
      if (av) setMyAvatarUrl(av);
    }
  }, [clerkLoaded, user, setLocation]);

  const { data: _roomInfo, isLoading: isLoadingRoom, error: roomError } = useGetRoom(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomQueryKey(roomId) }
  });

  const { roomState, connected, sendAction } = useWebSocket(roomId, userName, myAvatarUrl || null);

  const prevListenersRef = useRef<string[]>([]);
  useEffect(() => {
    if (!roomState) return;
    const prev = prevListenersRef.current;
    const curr = roomState.listeners;
    curr.filter(l => !prev.includes(l)).forEach(l => addActivity(`${l} đã vào phòng`));
    prev.filter(l => !curr.includes(l)).forEach(l => addActivity(`${l} đã rời phòng`));
    prevListenersRef.current = curr;
  }, [roomState?.listeners, addActivity]);

  // Fetch streak whenever listeners change (new person joins may create a session)
  const listenerCount = roomState?.listeners.length ?? 0;
  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/rooms/${roomId}/streak`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.streak === 'number') setStreak(d.streak); })
      .catch(() => {});
  }, [roomId, listenerCount]);

  useEffect(() => {
    if (roomState?.hostName && roomId) saveRecentRoom(roomId, roomState.hostName);
  }, [roomId, roomState?.hostName]);

  useEffect(() => {
    if (roomError) { toast({ title: "Phòng không tìm thấy", variant: "destructive" }); setLocation("/"); }
  }, [roomError, setLocation, toast]);

  const isRealHost = roomState?.hostName === userName;
  const isHost = hostActive && isRealHost;
  const democracyMode = roomState?.democracyMode ?? false;
  const effectiveIsHost = isHost || democracyMode;
  const currentTheme = THEMES.find(t => t.id === themeId) ?? THEMES[0];

  /* handlers */
  const handleAddTrack = (track: Track) => {
    sendAction({ type: "add_track", track });
    addActivity(`${userName} đã thêm "${track.title}"`);
  };
  const handleRemoveTrack = (i: number) => sendAction({ type: "remove_track", index: i });
  const handlePlayTrack = (i: number) => sendAction({ type: "play_track", index: i });
  const handleRemoveCurrent = () => sendAction({ type: "remove_current" });
  const handleRemovePlayed = (i: number) => sendAction({ type: "remove_played", index: i });
  const handleReplayPlayed = (i: number) => sendAction({ type: "replay_played", index: i });
  const handleSeek = (time: number) => sendAction({ type: "seek", currentTime: time });
  const handlePlayPause = () => {
    if (!roomState) return;
    sendAction({ type: "play_pause", playing: !roomState.playing, currentTime: playerCurrentTime });
  };
  const handleSkip = () => sendAction({ type: "skip" });
  const handlePrev = () => sendAction({ type: "prev_track" });
  const handleRepeat = () => sendAction({ type: "set_repeat" });
  const handleShuffle = () => sendAction({ type: "set_shuffle" });
  const handleToggleDemocracy = () => { if (isRealHost) sendAction({ type: "set_democracy" }); };
  const handlePlayerStateChange = (playing: boolean, currentTime: number) => {
    if (!effectiveIsHost) return;
    sendAction({ type: "seek", currentTime });
  };
  const handleTrackEnd = () => { if (effectiveIsHost) handleSkip(); };
  const handleSendMessage = (text: string) => sendAction({ type: "chat", text });
  const handleLeave = () => { setLocation("/"); };

  // Track unread messages in fullscreen chat bubble
  const chatMessages = roomState?.chatHistory || [];
  useEffect(() => {
    const newLen = chatMessages.length;
    if (newLen > prevChatLenRef.current && fullscreen && (!fsChatOpen || fsChatMinimized)) {
      setFsUnread(u => u + (newLen - prevChatLenRef.current));
    }
    prevChatLenRef.current = newLen;
  }, [chatMessages.length, fullscreen, fsChatOpen, fsChatMinimized]);

  if (!clerkLoaded || isLoadingRoom || !userName) return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const showPlayer = !!roomState?.currentTrack;

  return (
    <div
      className={`h-screen overflow-hidden w-full flex flex-col font-sans relative ${bgImageUrl ? '' : `bg-gradient-to-br ${currentTheme.bg}`}`}
      style={bgImageUrl ? { backgroundImage: `url(${bgImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {/* Petal BG dots */}
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, ${currentTheme.colors[1]}22 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, ${currentTheme.colors[2]}22 0%, transparent 50%)`
      }} />

      {/* ── Header ──────────────────────────── */}
      <header className="bg-white/60 backdrop-blur-md border-b border-white/40 shrink-0 z-30 shadow-sm flex items-center px-3 gap-2 h-[52px]">
        {/* App logo — orange headphone circle */}
        <button onClick={() => setLocation("/")}
          title="Về trang chủ"
          className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, #e87040, #f5a060)" }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
        </button>

        {/* Language button */}
        <button className="hidden md:flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-medium text-foreground/55 hover:bg-primary/8 hover:text-primary transition-colors shrink-0 border border-transparent hover:border-primary/15">
          <Globe className="w-3.5 h-3.5" />
          <span>Tiếng Việt</span>
        </button>

        {/* Divider */}
        <div className="hidden md:block w-px h-6 bg-foreground/10 shrink-0" />

        {/* Room info — 2 rows */}
        <div className="flex flex-col justify-center min-w-0 shrink-0">
          {/* Row 1: lock + room name */}
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-foreground/40 shrink-0" />
            <span className="font-bold text-foreground/85 text-[14px] leading-tight truncate max-w-[140px]">
              {roomState?.hostName ?? "..."}
            </span>
          </div>
          {/* Row 2: code · listeners · host badge · streak */}
          <div className="flex items-center gap-1.5 text-[10px] text-foreground/45">
            <span className="font-mono font-semibold tracking-wide">{roomId}</span>
            <span className="text-foreground/20">·</span>
            <Users className="w-2.5 h-2.5" />
            <span>{roomState?.listeners.length ?? 0}</span>
            {isRealHost && (
              <>
                <span className="text-foreground/20">·</span>
                <span className="text-[10px] font-bold text-[#e87040]">👑 HOST</span>
              </>
            )}
            {democracyMode && !isRealHost && (
              <>
                <span className="text-foreground/20">·</span>
                <span className="text-[10px] font-semibold text-primary">🗳️ Dân chủ</span>
              </>
            )}
            {streak > 0 && (
              <>
                <span className="text-foreground/20">·</span>
                <span className="text-[10px] font-bold text-orange-500/80 flex items-center gap-0.5">
                  🔥 {streak} ngày
                </span>
              </>
            )}
          </div>
        </div>

        {/* Status dot */}
        <div className="hidden lg:flex items-center gap-1 text-[10px] text-foreground/40 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {connected ? 'Live' : 'Offline'}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Toolbar */}
        <div className="flex items-center gap-0.5 shrink-0 overflow-x-auto">
          <div className="hidden md:contents">
            <ToolBtn icon={Minimize2} shortLabel="Thu gọn" label="Thu gọn player" onClick={() => setCompact(c => !c)} active={compact} />
          </div>
          <ToolBtn icon={Share2}    shortLabel="Chia sẻ"   label="Chia sẻ phòng" onClick={() => setShareOpen(true)} />
          <div className="hidden md:contents">
            <ToolBtn icon={CreditCard} shortLabel="Bưu thiếp" label="Bưu thiếp phòng" onClick={() => setPostcardOpen(true)} />
          </div>
          <ToolBtn icon={Palette}   shortLabel="Giao diện"  label="Giao diện phòng" onClick={() => setThemeOpen(true)} />
          <div className="hidden sm:contents">
            <ToolBtn icon={Coffee}    shortLabel="Tách cafe"  label="Ủng hộ admin một tách cafe ☕" onClick={() => setDonateOpen(true)} accent />
          </div>

          {/* Democracy mode — all see it; only real host can toggle */}
          <ToolBtn
            icon={Users}
            shortLabel={democracyMode ? "Dân chủ ON" : "Dân chủ OFF"}
            label={democracyMode ? "Dân chủ: Mọi người có thể điều khiển nhạc" : "Dân chủ: Chỉ host điều khiển"}
            onClick={handleToggleDemocracy}
            active={democracyMode}
            disabled={!isRealHost}
          />

          <ToolBtn icon={Settings}  shortLabel="Cài đặt"   label="Cài đặt phòng" onClick={() => setSettingsOpen(true)} />
          <ToolBtn icon={LogOut}    shortLabel="Rời phòng" label="Rời khỏi phòng" onClick={handleLeave} />
        </div>
      </header>

      {/* ── Main ──────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left: Player area (also becomes fullscreen overlay) */}
        {(!compact || fullscreen) && (
          <div className={fullscreen
            ? "fixed inset-0 z-[200] bg-black flex flex-col"
            : "hidden md:flex flex-1 flex-col min-w-0 overflow-y-auto min-h-0 p-5 gap-4"}>

            {/* YouTube player */}
            {showPlayer ? (
              <div className={fullscreen ? "flex-1 min-h-0 relative" : ""}>
                <YoutubePlayer
                  currentTrack={roomState?.currentTrack || null}
                  playing={roomState?.playing || false}
                  serverTime={roomState?.currentTime || 0}
                  isHost={effectiveIsHost}
                  volume={volume}
                  fullscreen={fullscreen}
                  onStateChange={handlePlayerStateChange}
                  onTrackEnd={handleTrackEnd}
                  onTimeUpdate={(ct, dur) => { setPlayerCurrentTime(ct); setPlayerDuration(dur); }}
                />
              </div>
            ) : !fullscreen && <WaitingIllustration />}

            {/* Normal player controls */}
            {!fullscreen && (showPlayer || roomState?.currentTrack) && (
              <PlayerControls
                isHost={effectiveIsHost}
                playing={roomState?.playing || false}
                currentTime={playerCurrentTime}
                duration={playerDuration}
                volume={volume}
                repeatMode={roomState?.repeatMode ?? 'all'}
                shuffle={roomState?.shuffle ?? false}
                onPlayPause={handlePlayPause}
                onSkip={handleSkip}
                onPrev={handlePrev}
                onSeek={handleSeek}
                onVolumeChange={setVolume}
                onRepeat={handleRepeat}
                onShuffle={handleShuffle}
                onFullscreen={() => { setFullscreen(true); setFsChatOpen(false); setFsChatMinimized(false); setFsUnread(0); }}
                disabled={!roomState?.currentTrack}
              />
            )}

            {/* ── Fullscreen overlay controls ── */}
            {fullscreen && (
              <>
                {/* Exit button top-right */}
                <button
                  onClick={() => setFullscreen(false)}
                  className="absolute top-4 right-4 z-[250] w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
                  title="Thoát toàn màn hình">
                  <Minimize2 className="w-4 h-4" />
                </button>

                {/* Player controls bar at bottom */}
                <div className="shrink-0 px-4 pb-4 pt-2" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }}>
                  <PlayerControls
                    isHost={effectiveIsHost}
                    playing={roomState?.playing || false}
                    currentTime={playerCurrentTime}
                    duration={playerDuration}
                    volume={volume}
                    repeatMode={roomState?.repeatMode ?? 'all'}
                    shuffle={roomState?.shuffle ?? false}
                    onPlayPause={handlePlayPause}
                    onSkip={handleSkip}
                    onPrev={handlePrev}
                    onSeek={handleSeek}
                    onVolumeChange={setVolume}
                    onRepeat={handleRepeat}
                    onShuffle={handleShuffle}
                    disabled={!roomState?.currentTrack}
                  />
                </div>

                {/* Chat bubble + panel (bottom-right, above controls) */}
                <div className="absolute bottom-36 right-5 z-20 flex flex-col items-end gap-3">
                  {fsChatOpen && !fsChatMinimized && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-200">
                      <FullscreenChat
                        messages={chatMessages}
                        currentUser={userName}
                        myAvatarUrl={myAvatarUrl || undefined}
                        userAvatars={roomState?.userAvatars}
                        onSendMessage={handleSendMessage}
                        onMinimize={() => setFsChatMinimized(true)}
                        onClose={() => { setFsChatOpen(false); setFsChatMinimized(false); }}
                      />
                    </div>
                  )}

                  {/* Bubble button */}
                  <button
                    onClick={() => {
                      if (fsChatOpen && !fsChatMinimized) {
                        setFsChatMinimized(true);
                      } else {
                        setFsChatOpen(true);
                        setFsChatMinimized(false);
                        setFsUnread(0);
                      }
                    }}
                    className="relative w-13 h-13 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    style={{ width: 52, height: 52, background: "linear-gradient(135deg,#c07080,#7a9e7e)" }}
                    title="Chat">
                    <MessageCircle className="w-6 h-6 text-white" />
                    {fsUnread > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm animate-bounce">
                        {fsUnread > 9 ? "9+" : fsUnread}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Right: Panel */}
        <div className={`${compact ? 'flex-1' : 'w-full md:w-[340px] xl:w-[380px]'} flex flex-col min-h-0 shrink-0`}>
          <RightPanel
            playlist={roomState?.playlist || []}
            playedTracks={roomState?.playedTracks || []}
            currentTrack={roomState?.currentTrack || null}
            chatMessages={roomState?.chatHistory || []}
            isHost={effectiveIsHost}
            currentUser={userName}
            myAvatarUrl={myAvatarUrl || undefined}
            userAvatars={roomState?.userAvatars}
            onAddTrack={handleAddTrack}
            onRemoveTrack={handleRemoveTrack}
            onPlayTrack={handlePlayTrack}
            onRemoveCurrent={handleRemoveCurrent}
            onRemovePlayed={handleRemovePlayed}
            onReplayPlayed={handleReplayPlayed}
            onSendMessage={handleSendMessage}
            activities={activities}
          />
        </div>
      </div>

      {/* ── Mobile mini-player bar (hidden on desktop) ── */}
      {!fullscreen && roomState?.currentTrack && (
        <div className="md:hidden shrink-0 flex items-center gap-3 px-3 py-2.5 bg-white/85 backdrop-blur-md border-t border-primary/10 shadow-[0_-4px_20px_rgba(192,112,128,0.1)]">
          {/* Thumbnail */}
          <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-sm">
            <img src={roomState.currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
            {roomState.playing && (
              <div className="absolute inset-0 bg-primary/25 flex items-center justify-center">
                <div className="flex gap-0.5 items-end h-3">
                  {[3,2,4].map((h, i) => (
                    <span key={i} className="w-0.5 bg-white rounded-full animate-bounce" style={{ height: h * 3, animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Title + seek */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground/80 truncate leading-tight">{roomState.currentTrack.title}</p>
            <p className="text-[10px] text-muted-foreground/50 truncate">{roomState.currentTrack.channelTitle}</p>
            <div className="mt-1.5 relative h-1 bg-primary/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-none"
                style={{ width: `${playerDuration > 0 ? (playerCurrentTime / playerDuration) * 100 : 0}%` }}
              />
            </div>
          </div>
          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handlePlayPause}
              disabled={!effectiveIsHost}
              className="w-10 h-10 rounded-full bg-primary/8 flex items-center justify-center text-primary disabled:opacity-40 active:scale-95 transition-transform">
              {roomState.playing
                ? <Pause className="w-4 h-4 fill-current" />
                : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button
              onClick={handleSkip}
              disabled={!effectiveIsHost}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground/50 disabled:opacity-30 active:scale-95 transition-transform">
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
            <button
              onClick={() => { setFullscreen(true); setFsChatOpen(false); setFsChatMinimized(false); setFsUnread(0); }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground/50 active:scale-95 transition-transform">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────── */}
      {shareOpen    && <ShareModal    roomId={roomId} onClose={() => setShareOpen(false)} />}
      {postcardOpen && <PostcardModal roomId={roomId} hostName={roomState?.hostName ?? ""} currentTrack={roomState?.currentTrack ?? null} listeners={roomState?.listeners ?? []} onClose={() => setPostcardOpen(false)} />}
      {themeOpen    && <ThemeModal    currentTheme={themeId} onSelect={setThemeId} bgImageUrl={bgImageUrl} onSetBgImage={handleSetBgImage} onClose={() => setThemeOpen(false)} />}
      {settingsOpen && <SettingsModal roomId={roomId} hostName={roomState?.hostName ?? ""} listeners={roomState?.listeners ?? []} isHost={isHost} themeId={themeId} onSelectTheme={setThemeId} onClose={() => setSettingsOpen(false)} />}
      {donateOpen   && <DonateModal   onClose={() => setDonateOpen(false)} />}
    </div>
  );
}
