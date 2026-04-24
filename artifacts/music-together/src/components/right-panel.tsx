import { useState, useRef, useEffect, useCallback } from "react";
import { Track, ChatMessage } from "@/lib/types";
import { getApiUrl } from "@/lib/runtime-config";
import { Input } from "@/components/ui/input";
import { Send, Smile, X, Plus, Search, Loader2, Check, Trash2, Play, Bell, Mic, MicOff, ImagePlus, ChevronDown, Music2, Link, Upload, Download, GripVertical } from "lucide-react";
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
  { id: "ding",  icon: "🔔", label: "Chuông nhẹ" },
  { id: "pop",   icon: "💬", label: "Tin nhắn"   },
  { id: "chime", icon: "🎵", label: "Nhạc nhẹ"   },
];

function playNotifSound(id: string) {
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
        className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors text-primary border border-primary/30 bg-primary/5">
        <Bell className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">ON</span>
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
  listeners: string[];
  hostName: string;
  currentUser: string;
  myAvatarUrl?: string;
  userAvatars?: Record<string, string>;
  onAddTrack: (t: Track) => void;
  onRemoveTrack: (i: number) => void;
  onMoveTrack: (fromIndex: number, toIndex: number) => void;
  onPlayTrack: (i: number) => void;
  onRemoveCurrent: () => void;
  onRemovePlayed: (i: number) => void;
  onMovePlayed: (fromIndex: number, toIndex: number) => void;
  onMovePlayedToQueue: (fromPlayedIndex: number, toQueueIndex: number) => void;
  onReplayPlayed: (i: number) => void;
  onSendMessage: (text: string) => void;
  activities: Activity[];
}

/* ─── RightPanel ────────────────────────────────────── */
export function RightPanel({
  playlist, playedTracks, currentTrack, chatMessages, isHost, listeners, hostName, currentUser,
  myAvatarUrl, userAvatars,
  onAddTrack, onRemoveTrack, onMoveTrack, onPlayTrack, onRemoveCurrent, onRemovePlayed, onMovePlayed, onMovePlayedToQueue, onReplayPlayed, onSendMessage, activities,
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
        ? <PlaylistTab playlist={playlist} playedTracks={playedTracks} currentTrack={currentTrack} isHost={isHost} listeners={listeners} hostName={hostName} userAvatars={userAvatars} onAddTrack={onAddTrack} onRemoveTrack={onRemoveTrack} onMoveTrack={onMoveTrack} onPlayTrack={onPlayTrack} onRemoveCurrent={onRemoveCurrent} onRemovePlayed={onRemovePlayed} onMovePlayed={onMovePlayed} onMovePlayedToQueue={onMovePlayedToQueue} onReplayPlayed={onReplayPlayed} />
        : <ChatTab messages={chatMessages} currentUser={currentUser} myAvatarUrl={myAvatarUrl} userAvatars={userAvatars} onSendMessage={onSendMessage} activities={activities} />}
    </div>
  );
}

/* ─── Playlist Tab ──────────────────────────────────── */
function PlaylistTab({ playlist, playedTracks, currentTrack, isHost, listeners, hostName, userAvatars, onAddTrack, onRemoveTrack, onMoveTrack, onPlayTrack, onRemoveCurrent, onRemovePlayed, onMovePlayed, onMovePlayedToQueue, onReplayPlayed }: {
  playlist: Track[]; playedTracks: Track[]; currentTrack: Track | null; isHost: boolean; listeners: string[]; hostName: string; userAvatars?: Record<string, string>;
  onAddTrack: (t: Track) => void; onRemoveTrack: (i: number) => void; onMoveTrack: (fromIndex: number, toIndex: number) => void; onPlayTrack: (i: number) => void;
  onRemoveCurrent: () => void; onRemovePlayed: (i: number) => void; onMovePlayed: (fromIndex: number, toIndex: number) => void; onMovePlayedToQueue: (fromPlayedIndex: number, toQueueIndex: number) => void; onReplayPlayed: (i: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"queue" | "search">("queue");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [urlLoading, setUrlLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ list: "played" | "queue"; index: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ list: "played" | "queue"; index: number } | null>(null);

  const canDropOnList = (targetList: "played" | "queue"): boolean => {
    if (!dragging) return false;
    if (dragging.list === targetList) return true;
    // Allow promoting a played track back into queue by drag-drop.
    if (dragging.list === "played" && targetList === "queue") return true;
    return false;
  };

  const handleDragStart = (list: "played" | "queue", index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    if (!isHost) return;
    setDragging({ list, index });
    setDragOver({ list, index });
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", `${list}:${index}`); } catch {}
  };

  const handleDragOver = (list: "played" | "queue", index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    if (!isHost || !canDropOnList(list)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver?.list !== list || dragOver.index !== index) {
      setDragOver({ list, index });
    }
  };

  const handleDrop = (list: "played" | "queue", index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isHost || !dragging || !canDropOnList(list)) {
      setDragging(null);
      setDragOver(null);
      return;
    }
    if (dragging.list === list) {
      const fromIndex = dragging.index;
      const toIndex = index;
      if (fromIndex !== toIndex) {
        if (list === "played") onMovePlayed(fromIndex, toIndex);
        else onMoveTrack(fromIndex, toIndex);
      }
    } else if (dragging.list === "played" && list === "queue") {
      const toQueueIndex = Math.max(0, Math.min(index, playlist.length));
      onMovePlayedToQueue(dragging.index, toQueueIndex);
    }
    setDragging(null);
    setDragOver(null);
  };

  const handleDragEnd = () => {
    setDragging(null);
    setDragOver(null);
  };

  useEffect(() => {
    if (!isHost) { setMode("queue"); setQuery(""); setSearchQuery(""); setUrlError(null); }
  }, [isHost]);

  const extractVideoId = (s: string): string | null => {
    try {
      if (s.includes("youtube.com") || s.includes("youtu.be")) {
        const url = new URL(s.startsWith("http") ? s : "https://" + s);
        if (url.hostname === "youtu.be") return url.pathname.slice(1).split(/[?&]/)[0];
        if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/shorts/")[1].split(/[?&/]/)[0];
        if (url.pathname.startsWith("/embed/")) return url.pathname.split("/embed/")[1].split(/[?&/]/)[0];
        if (url.pathname.startsWith("/live/")) return url.pathname.split("/live/")[1].split(/[?&/]/)[0];
        const v = url.searchParams.get("v");
        if (v) return v;
      }
      if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    } catch {}
    return null;
  };

  const isSoundCloudLink = (s: string): boolean => {
    try {
      const trimmed = s.trim();
      if (!trimmed) return false;
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const host = url.hostname.toLowerCase();
      return (
        host === "snd.sc" ||
        host === "soundcloud.app.goo.gl" ||
        host === "on.soundcloud.com" ||
        host === "soundcloud.com" ||
        host.endsWith(".soundcloud.com")
      );
    } catch {
      return false;
    }
  };

  const isSpotifyLink = (s: string): boolean => {
    try {
      const trimmed = s.trim();
      if (!trimmed) return false;
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const host = url.hostname.toLowerCase();
      return host === "open.spotify.com" || host === "spotify.link" || host === "spoti.fi" || host.endsWith(".spotify.com");
    } catch {
      return false;
    }
  };

  const isYoutubeUrl = !!extractVideoId(query.trim());
  const isSoundCloudUrl = isSoundCloudLink(query.trim());
  const isSpotifyUrl = isSpotifyLink(query.trim());

  const { data: results, isLoading: searchLoading } = useYoutubeSearch(
    { q: searchQuery },
    { query: { enabled: !!searchQuery && !isYoutubeUrl && !isSoundCloudUrl && !isSpotifyUrl, queryKey: getYoutubeSearchQueryKey({ q: searchQuery }) } }
  );

  const isLoading = searchLoading || urlLoading || uploadLoading;

  const markAdded = (videoId: string) => {
    setAddedIds(prev => new Set([...prev, videoId]));
    setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(videoId); return n; }), 2000);
  };

  const readErrorMessage = async (res: Response, fallback: string): Promise<string> => {
    try {
      const payload = await res.json();
      if (payload && typeof payload.error === "string" && payload.error.trim()) {
        return payload.error;
      }
    } catch {}
    return fallback;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setUrlError(null);
    const videoId = extractVideoId(q);
    if (videoId) {
      setUrlLoading(true);
      try {
        const res = await fetch(getApiUrl(`/api/youtube/video/${videoId}`));
        if (!res.ok) throw new Error(await readErrorMessage(res, "Request failed"));
        const video = await res.json();
        onAddTrack({ videoId: video.videoId, source: "youtube", title: video.title, channelTitle: video.channelTitle, thumbnail: video.thumbnail, duration: video.duration });
        markAdded(video.videoId);
        setQuery("");
        setMode("queue");
      } catch (err) {
        setUrlError(err instanceof Error && err.message !== "Request failed" ? err.message : "Không tải được video. Thử lại nhé!");
      } finally {
        setUrlLoading(false);
      }
    } else if (isSoundCloudLink(q)) {
      setUrlLoading(true);
      try {
        const res = await fetch(getApiUrl(`/api/soundcloud/resolve?url=${encodeURIComponent(q)}`));
        if (!res.ok) throw new Error(await readErrorMessage(res, "Request failed"));
        const track = await res.json();
        onAddTrack(track);
        markAdded(track.videoId);
        setQuery("");
        setMode("queue");
      } catch (err) {
        setUrlError(err instanceof Error && err.message !== "Request failed" ? err.message : "Khong resolve duoc link SoundCloud.");
      } finally {
        setUrlLoading(false);
      }
    } else if (isSpotifyLink(q)) {
      setUrlLoading(true);
      try {
        const res = await fetch(getApiUrl(`/api/spotify/resolve?url=${encodeURIComponent(q)}`));
        if (!res.ok) throw new Error(await readErrorMessage(res, "Request failed"));
        const track = await res.json();
        onAddTrack(track);
        markAdded(track.videoId);
        setQuery("");
        setMode("queue");
      } catch (err) {
        setUrlError(err instanceof Error && err.message !== "Request failed" ? err.message : "Khong resolve duoc link Spotify.");
      } finally {
        setUrlLoading(false);
      }
    } else {
      setSearchQuery(q);
      setMode("search");
    }
  };
  const handleAdd = (video: any) => {
    onAddTrack({ videoId: video.videoId, source: "youtube", title: video.title, channelTitle: video.channelTitle, thumbnail: video.thumbnail, duration: video.duration });
    markAdded(video.videoId);
  };
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUrlError(null);
    setUploadLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(getApiUrl("/api/media/upload"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          dataUrl,
          title: file.name.replace(/\.[^.]+$/, ""),
          userName: hostName || "Uploaded file",
        }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Request failed"));
      const track = await res.json();
      onAddTrack(track);
      markAdded(track.videoId);
      setMode("queue");
    } catch (err) {
      setUrlError(err instanceof Error && err.message !== "Request failed" ? err.message : "Upload that bai. Chi ho tro file audio/video.");
    } finally {
      setUploadLoading(false);
    }
  };
  const downloadTrack = (track: Track) => {
    if (track.source !== "upload" || !track.mediaUrl) {
      alert("Hien chi tai offline duoc voi file ban da upload.");
      return;
    }
    const chosen = (window.prompt("Chon dinh dang tai (mp3 hoac mp4)", "mp3") || "").trim().toLowerCase();
    if (chosen !== "mp3" && chosen !== "mp4") return;
    const mime = track.mimeType ?? "";
    const canMp3 = mime.includes("mpeg") || (track.fileName?.toLowerCase().endsWith(".mp3") ?? false);
    const canMp4 = mime.includes("mp4") || (track.fileName?.toLowerCase().endsWith(".mp4") ?? false);
    if ((chosen === "mp3" && !canMp3) || (chosen === "mp4" && !canMp4)) {
      alert("File nay chua ho tro chuyen doi dinh dang. Hay tai dung dinh dang goc.");
      return;
    }
    const fileName = decodeURIComponent((track.mediaUrl.split("/").pop() || "").split("?")[0]);
    const dl = getApiUrl(`/api/media/files/${encodeURIComponent(fileName)}?download=1&name=${encodeURIComponent(track.title)}&format=${chosen}`);
    const a = document.createElement("a");
    a.href = dl;
    a.click();
  };
  const clearSearch = () => { setQuery(""); setSearchQuery(""); setMode("queue"); setUrlError(null); };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {isHost && (
        <div className="p-3 border-b border-primary/5 bg-white/40 shrink-0">
          <input ref={fileInputRef} type="file" accept="audio/*,video/*" className="hidden" onChange={handleUploadFile} />
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              {(isYoutubeUrl || isSoundCloudUrl || isSpotifyUrl)
                ? <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
                : <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />}
              <Input value={query} onChange={e => { setQuery(e.target.value); setUrlError(null); }}
                placeholder="Dán link hoặc nhập tên bài hát..."
                className="pl-9 h-10 bg-white border-primary/10 rounded-2xl text-sm focus-visible:ring-primary/20 shadow-sm" />
            </div>
            <button type="submit" disabled={isLoading}
              className="w-10 h-10 rounded-2xl bg-primary/10 hover:bg-primary text-primary hover:text-white flex items-center justify-center transition-all shrink-0 disabled:opacity-50">
              {urlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading}
              className="w-10 h-10 rounded-2xl bg-secondary/10 hover:bg-secondary text-secondary hover:text-white flex items-center justify-center transition-all shrink-0 disabled:opacity-50"
              title="Tải file từ máy">
              {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            </button>
          </form>
          {(isYoutubeUrl || isSoundCloudUrl || isSpotifyUrl) && !urlError && (
            <p className="text-[11px] text-primary/60 mt-1 pl-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-primary/50 rounded-full inline-block" />
              {isSoundCloudUrl
                ? "Link SoundCloud - nhan + de them ngay"
                : isSpotifyUrl
                  ? "Link Spotify - se map sang ban YouTube de phat"
                  : "Link YouTube - nhan + de them ngay"}
            </p>
          )}
          {urlError && <p className="text-[11px] text-red-400 mt-1 pl-1">{urlError}</p>}
          {mode === "search" && !isYoutubeUrl && (
            <button onClick={clearSearch} className="flex items-center gap-1 text-xs text-primary/60 hover:text-primary mt-2 pl-1 transition-colors">
              <X className="w-3 h-3" /> Về hàng đợi
            </button>
          )}
        </div>
      )}
      {!isHost && (
        <div className="px-3 py-2 bg-muted/30 border-b border-primary/5 shrink-0">
          <p className="text-[11px] text-muted-foreground/50 text-center italic">Chỉ host mới có thể thêm bài khi không có chế độ dân chủ</p>
        </div>
      )}

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
          <>

          {!currentTrack && playlist.length === 0 && playedTracks.length === 0 ? (
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
                    <div key={`played-${track.videoId}-${i}`}
                      draggable={isHost}
                      onDragStart={handleDragStart("played", i)}
                      onDragOver={handleDragOver("played", i)}
                      onDrop={handleDrop("played", i)}
                      onDragEnd={handleDragEnd}
                      className={`group flex items-center gap-2.5 p-2.5 rounded-2xl transition-all ${
                        dragOver?.list === "played" && dragOver.index === i
                          ? "ring-2 ring-primary/30 bg-primary/5"
                          : "hover:bg-white/60"
                      } ${
                        dragging?.list === "played" && dragging.index === i
                          ? "opacity-25"
                          : "hover:opacity-100 opacity-50"
                      } ${isHost ? "cursor-grab active:cursor-grabbing" : ""}`}>
                      {isHost && (
                        <div className="w-5 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground/30">
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="relative w-12 h-10 rounded-xl overflow-hidden flex-shrink-0 shrink-0">
                        <img src={track.thumbnail} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground/70 line-clamp-1">{track.title}</p>
                        <p className="text-[10px] text-muted-foreground/50">{track.channelTitle}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {track.source === "upload" && track.mediaUrl && (
                          <button onClick={() => downloadTrack(track)}
                            className="w-7 h-7 rounded-xl text-secondary/70 hover:text-white hover:bg-secondary flex items-center justify-center transition-all"
                            title="Tải offline">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isHost && (
                          <>
                          <button onClick={() => onReplayPlayed(i)}
                            className="w-7 h-7 rounded-xl text-primary/60 hover:text-white hover:bg-primary flex items-center justify-center transition-all"
                            title="Phát lại">
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button onClick={() => onRemovePlayed(i)}
                            className="w-7 h-7 rounded-xl text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
                            title="Xóa khỏi lịch sử">
                            <X className="w-3.5 h-3.5" />
                          </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {currentTrack && <div className="h-px bg-primary/10 mx-1" />}
                </>
              )}
              {currentTrack && (
                <div className="group flex items-center gap-2.5 p-2.5 rounded-2xl bg-primary/5 border border-primary/20">
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
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {currentTrack.source === "upload" && currentTrack.mediaUrl && (
                      <button onClick={() => downloadTrack(currentTrack)}
                        className="w-7 h-7 rounded-xl text-secondary/70 hover:text-white hover:bg-secondary flex items-center justify-center transition-all"
                        title="Tải offline">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isHost && (
                      <button onClick={onRemoveCurrent}
                        className="w-7 h-7 rounded-xl text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
                        title="Bỏ qua bài này">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {(playlist.length > 0 || (isHost && dragging?.list === "played")) && (
                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider px-1 pt-1">Tiếp theo</p>
              )}
              {isHost && dragging && (dragging.list === "played" || dragging.list === "queue") && (
                <div
                  onDragOver={handleDragOver("queue", playlist.length)}
                  onDrop={handleDrop("queue", playlist.length)}
                  className={`mx-1 rounded-xl border border-dashed px-3 py-2 text-[11px] transition-all ${
                    dragOver?.list === "queue" && dragOver.index === playlist.length
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-primary/20 text-muted-foreground/50"
                  }`}
                >
                  {playlist.length === 0 ? "Thả vào đây để chuyển từ Đã phát sang Tiếp theo" : "Thả vào đây để đưa xuống cuối Tiếp theo"}
                </div>
              )}
              {playlist.map((track, i) => (
                <div key={`${track.videoId}-${i}`}
                  draggable={isHost}
                  onDragStart={handleDragStart("queue", i)}
                  onDragOver={handleDragOver("queue", i)}
                  onDrop={handleDrop("queue", i)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center gap-2 p-2.5 rounded-2xl border border-transparent transition-all ${
                    dragOver?.list === "queue" && dragOver.index === i
                      ? "ring-2 ring-primary/30 bg-primary/5"
                      : "hover:bg-white hover:shadow-sm hover:border-primary/10"
                  } ${
                    dragging?.list === "queue" && dragging.index === i ? "opacity-40" : ""
                  } ${isHost ? "cursor-grab active:cursor-grabbing" : ""}`}>
                  {isHost && (
                    <div className="w-5 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground/35">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <img src={track.thumbnail} alt="" className="w-12 h-10 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{track.title}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{track.channelTitle}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {track.source === "upload" && track.mediaUrl && (
                      <button onClick={() => downloadTrack(track)}
                        className="w-7 h-7 rounded-xl text-secondary/70 hover:text-white hover:bg-secondary flex items-center justify-center transition-all"
                        title="Tải offline">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                  {isHost && (
                    <>
                      <button onClick={() => onPlayTrack(i)}
                        className="w-7 h-7 rounded-xl text-primary/60 hover:text-white hover:bg-primary flex items-center justify-center transition-all"
                        title="Phát ngay">
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button onClick={() => onRemoveTrack(i)}
                        className="w-7 h-7 rounded-xl text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
                        title="Xóa khỏi hàng đợi">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  </div>
                </div>
              ))}
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Chat Tab ──────────────────────────────────────── */
function ChatTab({ messages, currentUser, myAvatarUrl, userAvatars, onSendMessage, activities }: {
  messages: ChatMessage[]; currentUser: string;
  myAvatarUrl?: string; userAvatars?: Record<string, string>;
  onSendMessage: (t: string) => void;
  activities: Activity[];
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
  }, [messages, activities]);

  const joinActivities = activities.filter((item) => item.text.includes("đã vào phòng"));

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
        {messages.length === 0 && joinActivities.length === 0 ? (
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
            {joinActivities.map((activity, i) => (
              <div
                key={`activity-${i}-${activity.time}`}
                className="flex items-center gap-2 rounded-[1.35rem] border border-[#e8d7cf] bg-[#fbf7f4] px-4 py-3 shadow-[0_2px_10px_rgba(180,120,90,0.06)] animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="w-6 h-6 rounded-full bg-white text-[#c27b63] flex items-center justify-center shrink-0 border border-[#eddcd4]">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1 flex items-center gap-2 text-[13px] text-foreground/80">
                  <span className="shrink-0">🎉</span>
                  <span className="truncate font-medium">{activity.text}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/45 shrink-0">{activity.time}</span>
              </div>
            ))}
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
          <Picker data={data} set="native" theme="light" locale="vi"
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
