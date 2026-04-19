import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useWebSocket } from "@/hooks/use-websocket";
import { Track } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { YoutubePlayer } from "@/components/youtube-player";
import { PlayerControls } from "@/components/player-controls";
import { RightPanel } from "@/components/right-panel";
import {
  Music, Loader2, Copy, LogOut, Minimize2, Share2, CreditCard,
  Palette, Coffee, UserCheck, Settings, Globe, Users, X, Download, Check, Heart
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
  { id: "cream",    name: "Kem hoa",    colors: ["#fdf6f0","#c07080","#7a9e7e"], bg: "from-[#fdf6f0] via-[#fce8e8] to-[#eef5ef]" },
  { id: "midnight", name: "Đêm xanh",   colors: ["#1e1b2e","#8b7dff","#5eead4"], bg: "from-[#1e1b2e] via-[#2d1b3d] to-[#1a2e2a]" },
  { id: "garden",   name: "Vườn xanh",  colors: ["#eef4ee","#4a7c59","#8b7355"], bg: "from-[#eef4ee] via-[#ddeedd] to-[#f5f0e8]" },
  { id: "rose",     name: "Hồng phấn",  colors: ["#fdf0f3","#d4687a","#d4a064"], bg: "from-[#fdf0f3] via-[#fce0e8] to-[#fdf5e8]" },
  { id: "lavender", name: "Oải hương",  colors: ["#f4f0fc","#8b6cce","#c07080"], bg: "from-[#f4f0fc] via-[#ece0f8] to-[#fce8f0]" },
  { id: "ocean",    name: "Đại dương",  colors: ["#eef4f8","#2d7dd2","#2da88e"], bg: "from-[#eef4f8] via-[#ddeef8] to-[#e0f5f0]" },
];

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
function ThemeModal({ currentTheme, onSelect, onClose }: { currentTheme: string; onSelect: (id: string) => void; onClose: () => void }) {
  return (
    <ModalBase title="Giao diện phòng" onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-4">Chọn màu nền yêu thích của bạn</p>
      <div className="grid grid-cols-3 gap-3">
        {THEMES.map(t => (
          <button key={t.id} onClick={() => { onSelect(t.id); onClose(); }}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all hover:scale-105 ${currentTheme === t.id ? 'border-primary shadow-md' : 'border-primary/10 hover:border-primary/30'}`}>
            <div className="flex gap-1">
              {t.colors.map((c, i) => <div key={i} className="w-5 h-5 rounded-full border border-white/50 shadow-sm" style={{ background: c }} />)}
            </div>
            <span className="text-xs font-medium text-foreground/70">{t.name}</span>
            {currentTheme === t.id && <Check className="w-3 h-3 text-primary" />}
          </button>
        ))}
      </div>
    </ModalBase>
  );
}

/* ──────────────── Settings Modal ──────────────── */
function SettingsModal({ roomId, hostName, listeners, onClose }: { roomId: string; hostName: string; listeners: string[]; onClose: () => void }) {
  return (
    <ModalBase title="Cài đặt phòng" onClose={onClose}>
      <div className="space-y-3">
        <InfoRow label="Mã phòng" value={roomId} mono />
        <InfoRow label="Chủ phòng" value={hostName} />
        <InfoRow label="Thành viên" value={`${listeners.length} người`} />
      </div>
    </ModalBase>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-primary/5 rounded-2xl">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold text-foreground ${mono ? 'font-mono tracking-wider' : ''}`}>{value}</span>
    </div>
  );
}

/* ──────────────── Modal Base ──────────────── */
function ModalBase({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white/95 rounded-3xl shadow-2xl w-full max-w-md p-6 relative animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-serif italic font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-primary/10 flex items-center justify-center text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ──────────────── Toolbar Button ──────────────── */
function ToolBtn({ icon: Icon, label, onClick, active = false, accent = false, disabled = false }: {
  icon: any; label: string; onClick: () => void; active?: boolean; accent?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center justify-center w-8 h-8 rounded-xl text-xs font-medium transition-all select-none shrink-0
        ${accent ? 'bg-[#f5922f]/15 hover:bg-[#f5922f]/25 text-[#f5922f]' :
          active ? 'bg-primary/15 text-primary' :
          'text-muted-foreground/60 hover:bg-primary/8 hover:text-primary'}
        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-4 h-4" />
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

  const [userName, setUserName] = useState<string | null>(null);
  const [volume, setVolume] = useState(80);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);

  // Toolbar state
  const [compact, setCompact] = useState(false);
  const [hostActive, setHostActive] = useState(true);
  const [themeId, setThemeId] = useState("cream");

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

  useEffect(() => {
    const name = sessionStorage.getItem("music-together-name");
    if (!name) { setLocation("/"); return; }
    setUserName(name);
    const av = sessionStorage.getItem("music-together-avatar");
    if (av) setMyAvatarUrl(av);
  }, [setLocation]);

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

  useEffect(() => {
    if (roomState?.hostName && roomId) saveRecentRoom(roomId, roomState.hostName);
  }, [roomId, roomState?.hostName]);

  useEffect(() => {
    if (roomError) { toast({ title: "Phòng không tìm thấy", variant: "destructive" }); setLocation("/"); }
  }, [roomError, setLocation, toast]);

  const isHost = hostActive && roomState?.hostName === userName;
  const currentTheme = THEMES.find(t => t.id === themeId) ?? THEMES[0];

  /* handlers */
  const handleAddTrack = (track: Track) => {
    sendAction({ type: "add_track", track });
    addActivity(`${userName} đã thêm "${track.title}"`);
  };
  const handleRemoveTrack = (i: number) => sendAction({ type: "remove_track", index: i });
  const handlePlayTrack = (i: number) => sendAction({ type: "play_track", index: i });
  const handleSeek = (time: number) => sendAction({ type: "seek", currentTime: time });
  const handlePlayPause = () => {
    if (!roomState) return;
    sendAction({ type: "play_pause", playing: !roomState.playing, currentTime: playerCurrentTime });
  };
  const handleSkip = () => sendAction({ type: "skip" });
  const handlePrev = () => sendAction({ type: "prev_track" });
  const handleRepeat = () => sendAction({ type: "set_repeat" });
  const handleShuffle = () => sendAction({ type: "set_shuffle" });
  const handlePlayerStateChange = (playing: boolean, currentTime: number) => {
    if (!isHost) return;
    sendAction({ type: "seek", currentTime });
  };
  const handleTrackEnd = () => { if (isHost) handleSkip(); };
  const handleSendMessage = (text: string) => sendAction({ type: "chat", text });
  const handleLeave = () => { sessionStorage.removeItem("music-together-name"); setLocation("/"); };

  if (isLoadingRoom || !userName) return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const showPlayer = !!roomState?.currentTrack;

  return (
    <div className={`h-screen overflow-hidden w-full flex flex-col font-sans bg-gradient-to-br ${currentTheme.bg} relative`}>
      {/* Petal BG dots */}
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, ${currentTheme.colors[1]}22 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, ${currentTheme.colors[2]}22 0%, transparent 50%)`
      }} />

      {/* ── Header ──────────────────────────── */}
      <header className="h-14 bg-white/50 backdrop-blur-md border-b border-white/40 flex items-center px-4 gap-2 shrink-0 z-30 shadow-sm">
        {/* Logo */}
        <button onClick={() => setLocation("/")}
          className="w-9 h-9 rounded-2xl flex items-center justify-center border border-primary/20 hover:bg-primary/10 transition-colors shrink-0"
          style={{ background: `${currentTheme.colors[0]}cc` }}>
          <Music className="w-4.5 h-4.5 text-primary" />
        </button>

        {/* Language */}
        <button className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs text-muted-foreground hover:bg-primary/5 transition-colors hidden sm:flex shrink-0">
          <Globe className="w-3.5 h-3.5" />
          <span>Tiếng Việt</span>
        </button>

        {/* User info */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/60 rounded-xl border border-primary/10 text-xs shrink-0">
          <div className="w-5 h-5 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center flex-shrink-0">
            {myAvatarUrl ? (
              <img src={myAvatarUrl} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-primary">{userName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <span className="font-medium text-foreground/80 hidden sm:inline">{userName}</span>
          <span className="text-muted-foreground/50 hidden sm:inline">·</span>
          <span className="font-mono font-bold text-foreground/60">{roomId}</span>
          <span className="text-muted-foreground/50">·</span>
          <Users className="w-3 h-3 text-muted-foreground/50" />
          <span className="text-muted-foreground/70">{roomState?.listeners.length ?? 0}</span>
          {roomState?.hostName === userName && (
            <span className="text-[10px] font-bold text-[#f5922f] border border-[#f5922f]/30 px-1.5 py-0.5 rounded-full">HOST</span>
          )}
        </div>

        {/* Status */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground/60 px-2">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {connected ? 'Live' : 'Reconnecting...'}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Toolbar buttons — icon only, hover title */}
        <div className="flex items-center gap-0.5 shrink-0">
          <ToolBtn icon={Minimize2} label="Thu gọn" onClick={() => setCompact(c => !c)} active={compact} />
          <ToolBtn icon={Share2} label="Chia sẻ" onClick={() => setShareOpen(true)} />
          <ToolBtn icon={CreditCard} label="Bưu thiếp phòng" onClick={() => setPostcardOpen(true)} />
          <ToolBtn icon={Palette} label="Giao diện phòng" onClick={() => setThemeOpen(true)} />
          <ToolBtn icon={Coffee} label="Tách cafe cho admin ☕" onClick={() => setDonateOpen(true)} accent />
          <ToolBtn
            icon={UserCheck}
            label={hostActive ? "Dẫn chủ ON" : "Dẫn chủ OFF"}
            onClick={() => setHostActive(a => !a)}
            active={hostActive}
            disabled={roomState?.hostName !== userName}
          />
          <ToolBtn icon={Settings} label="Cài đặt" onClick={() => setSettingsOpen(true)} />
          <ToolBtn icon={LogOut} label="Rời phòng" onClick={handleLeave} />
        </div>
      </header>

      {/* ── Main ──────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left: Player area */}
        {!compact && (
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-0 p-5 gap-4">
            {showPlayer ? (
              <>
                <YoutubePlayer
                  currentTrack={roomState?.currentTrack || null}
                  playing={roomState?.playing || false}
                  serverTime={roomState?.currentTime || 0}
                  isHost={isHost}
                  volume={volume}
                  onStateChange={handlePlayerStateChange}
                  onTrackEnd={handleTrackEnd}
                  onTimeUpdate={(ct, dur) => { setPlayerCurrentTime(ct); setPlayerDuration(dur); }}
                />
                <PlayerControls
                  isHost={isHost}
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
              </>
            ) : (
              <>
                <WaitingIllustration />
                {roomState?.currentTrack && (
                  <PlayerControls
                    isHost={isHost}
                    playing={roomState.playing}
                    currentTime={playerCurrentTime}
                    duration={playerDuration}
                    volume={volume}
                    repeatMode={roomState.repeatMode ?? 'all'}
                    shuffle={roomState.shuffle ?? false}
                    onPlayPause={handlePlayPause}
                    onSkip={handleSkip}
                    onPrev={handlePrev}
                    onSeek={handleSeek}
                    onVolumeChange={setVolume}
                    onRepeat={handleRepeat}
                    onShuffle={handleShuffle}
                    disabled={false}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Right: Panel */}
        <div className={`${compact ? 'flex-1' : 'w-[340px] xl:w-[380px]'} flex flex-col min-h-0 shrink-0`}>
          <RightPanel
            playlist={roomState?.playlist || []}
            playedTracks={roomState?.playedTracks || []}
            currentTrack={roomState?.currentTrack || null}
            chatMessages={roomState?.chatHistory || []}
            isHost={isHost}
            currentUser={userName}
            myAvatarUrl={myAvatarUrl || undefined}
            userAvatars={roomState?.userAvatars}
            onAddTrack={handleAddTrack}
            onRemoveTrack={handleRemoveTrack}
            onPlayTrack={handlePlayTrack}
            onSendMessage={handleSendMessage}
            activities={activities}
          />
        </div>
      </div>

      {/* ── Modals ──────────────────────────── */}
      {shareOpen    && <ShareModal    roomId={roomId} onClose={() => setShareOpen(false)} />}
      {postcardOpen && <PostcardModal roomId={roomId} hostName={roomState?.hostName ?? ""} currentTrack={roomState?.currentTrack ?? null} listeners={roomState?.listeners ?? []} onClose={() => setPostcardOpen(false)} />}
      {themeOpen    && <ThemeModal    currentTheme={themeId} onSelect={setThemeId} onClose={() => setThemeOpen(false)} />}
      {settingsOpen && <SettingsModal roomId={roomId} hostName={roomState?.hostName ?? ""} listeners={roomState?.listeners ?? []} onClose={() => setSettingsOpen(false)} />}
      {donateOpen   && <DonateModal   onClose={() => setDonateOpen(false)} />}
    </div>
  );
}
