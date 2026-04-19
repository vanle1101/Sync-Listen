import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateRoom } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Music, Clock, ArrowRight, X, Camera, LogOut } from "lucide-react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          renderButton: (el: HTMLElement, opts: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface RecentRoom {
  id: string;
  hostName: string;
  visitedAt: number;
}

interface UserProfile {
  name: string;
  avatarUrl?: string;
  source?: "google" | "manual";
}

const PROFILE_KEY = "music-together-profile";

function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveProfile(profile: UserProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  sessionStorage.setItem("music-together-name", profile.name);
  if (profile.avatarUrl) sessionStorage.setItem("music-together-avatar", profile.avatarUrl);
}

function getRecentRooms(): RecentRoom[] {
  try {
    const raw = localStorage.getItem("music-together-rooms");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function decodeGoogleJwt(token: string): { name: string; picture: string; email: string } | null {
  try {
    const parts = token.split(".");
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { name: payload.name, picture: payload.picture, email: payload.email };
  } catch { return null; }
}

function AvatarCircle({ url, name, size = 88, onClick }: { url?: string; name: string; size?: number; onClick?: () => void }) {
  const initial = name.trim()[0]?.toUpperCase() || "?";
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{ width: size, height: size }}
      title="Đổi ảnh đại diện"
    >
      <div className="w-full h-full rounded-full overflow-hidden border-2 border-primary/20 shadow-md bg-gradient-to-br from-primary/10 to-secondary/20 flex items-center justify-center transition-all group-hover:border-primary/50">
        {url ? (
          <img src={url} alt={name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span className="font-serif italic font-bold text-primary/60" style={{ fontSize: size * 0.38 }}>{initial}</span>
        )}
      </div>
      {onClick && (
        <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="text-white drop-shadow" style={{ width: size * 0.28, height: size * 0.28 }} />
        </div>
      )}
    </button>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarSource, setAvatarSource] = useState<"google" | "manual" | undefined>();
  const [joinRoomId, setJoinRoomId] = useState("");
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [googleReady, setGoogleReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const createRoom = useCreateRoom();
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    setRecentRooms(getRecentRooms());
    const profile = loadProfile();
    if (profile) {
      setName(profile.name);
      if (profile.avatarUrl) { setAvatarUrl(profile.avatarUrl); setAvatarSource(profile.source); }
    }
  }, []);

  // Init Google Identity Services
  useEffect(() => {
    if (!clientId) return;
    const tryInit = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => {
          const info = decodeGoogleJwt(response.credential);
          if (!info) return;
          setName(info.name);
          setAvatarUrl(info.picture);
          setAvatarSource("google");
          saveProfile({ name: info.name, avatarUrl: info.picture, source: "google" });
        },
      });
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: "standard",
          shape: "pill",
          theme: "outline",
          text: "signin_with",
          size: "large",
          logo_alignment: "left",
          width: 280,
          locale: "vi",
        });
      }
      setGoogleReady(true);
    };
    // GIS script might not be loaded yet
    if (window.google) {
      tryInit();
    } else {
      const timer = setInterval(() => {
        if (window.google) { clearInterval(timer); tryInit(); }
      }, 200);
      return () => clearInterval(timer);
    }
  }, [clientId]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);
      setAvatarSource("manual");
      const profile = loadProfile() ?? { name };
      saveProfile({ ...profile, name: name || profile.name, avatarUrl: dataUrl, source: "manual" });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleLogoutGoogle = () => {
    setAvatarUrl("");
    setAvatarSource(undefined);
    const profile = loadProfile();
    if (profile) saveProfile({ ...profile, avatarUrl: undefined, source: undefined });
  };

  const persistAndGo = (roomPath: string) => {
    saveProfile({ name: name.trim(), avatarUrl: avatarUrl || undefined, source: avatarSource });
    setLocation(roomPath);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createRoom.mutate({ data: { hostName: name.trim() } }, {
      onSuccess: (room) => persistAndGo(`/room/${room.id}`),
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !joinRoomId.trim()) return;
    let id = joinRoomId.trim();
    if (id.includes("/room/")) id = id.split("/room/")[1];
    persistAndGo(`/room/${id}`);
  };

  const handleJoinRecent = (room: RecentRoom) => {
    if (!name.trim()) { setJoinRoomId(room.id); return; }
    persistAndGo(`/room/${room.id}`);
  };

  const handleRemoveRecent = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    try {
      const raw = localStorage.getItem("music-together-rooms");
      const rooms: RecentRoom[] = raw ? JSON.parse(raw) : [];
      const updated = rooms.filter((r) => r.id !== roomId);
      localStorage.setItem("music-together-rooms", JSON.stringify(updated));
      setRecentRooms(updated);
    } catch {}
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden petal-bg">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-start z-10 relative">
        {/* Left: branding */}
        <div className="space-y-6 text-center md:text-left">
          <div className="inline-flex items-center justify-center p-4 bg-white/80 rounded-3xl border border-primary/10 mb-4 shadow-sm soft-glow">
            <Music className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-5xl md:text-7xl font-serif text-foreground leading-tight italic font-light">
            Music <br className="hidden md:block" />
            <span className="text-primary not-italic font-normal">Together.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-md mx-auto md:mx-0 font-light leading-relaxed">
            Nghe nhạc cùng nhau. Tạo phòng, mời bạn bè và chia sẻ giai điệu yêu thích.
          </p>

          {recentRooms.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-medium tracking-wide uppercase text-xs">Phòng đã ghé thăm</span>
              </div>
              <div className="space-y-2">
                {recentRooms.slice(0, 5).map((room) => (
                  <div key={room.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => handleJoinRecent(room)}
                      className="flex-1 flex items-center justify-between gap-3 bg-white/60 hover:bg-white/90 border border-primary/10 rounded-2xl px-4 py-3 transition-all hover:shadow-sm hover:border-primary/20 group/btn text-left min-w-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Music className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">Phòng của {room.hostName}</p>
                          <p className="text-xs text-muted-foreground/60">{timeAgo(room.visitedAt)}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-primary/40 group-hover/btn:text-primary/70 flex-shrink-0 transition-colors" />
                    </button>
                    <button
                      onClick={(e) => handleRemoveRecent(e, room.id)}
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground/30 hover:text-primary/60 hover:bg-primary/5 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: join form */}
        <Card className="bloom-card p-4 relative overflow-hidden border-none">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-3xl font-serif text-foreground italic font-medium">Vào phòng</CardTitle>
            <CardDescription className="text-muted-foreground">Nhập tên và ảnh đại diện của bạn</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Avatar + Google login section */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <AvatarCircle url={avatarUrl} name={name || "?"} size={88} onClick={() => fileInputRef.current?.click()} />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <p className="text-[11px] text-muted-foreground/50">Nhấn vào ảnh để thay đổi</p>

              {/* Google login */}
              {clientId ? (
                avatarSource === "google" ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60 bg-white/60 rounded-2xl px-4 py-2 border border-primary/10">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Đã đăng nhập với Google
                    <button onClick={handleLogoutGoogle} className="ml-1 hover:text-primary transition-colors">
                      <LogOut className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-[11px] text-muted-foreground/40">hoặc đăng nhập để tự điền thông tin</p>
                    <div ref={googleBtnRef} className="overflow-hidden rounded-2xl" />
                  </div>
                )
              ) : null}
            </div>

            {/* Name input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground pl-1">Tên của bạn</label>
              <Input
                placeholder="v.d. Lan Anh"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-14 bg-white/50 border-primary/10 text-lg rounded-2xl focus-visible:ring-primary/30 transition-all shadow-sm"
                autoFocus
              />
            </div>

            {/* Create room */}
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-primary/10" /></div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white/80 px-4 text-muted-foreground/60 font-medium tracking-widest uppercase">Tạo mới</span>
                </div>
              </div>
              <Button
                onClick={handleCreateRoom}
                disabled={!name.trim() || createRoom.isPending}
                className="w-full h-14 text-lg font-medium rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-[0_8px_20px_rgba(192,112,128,0.28)] transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {createRoom.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Tạo phòng mới"}
              </Button>
            </div>

            {/* Join room */}
            <div className="space-y-4 pt-2">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-primary/10" /></div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white/80 px-4 text-muted-foreground/60 font-medium tracking-widest uppercase">Hoặc tham gia</span>
                </div>
              </div>
              <form onSubmit={handleJoinRoom} className="flex gap-3">
                <Input
                  placeholder="Nhập link hoặc mã phòng"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="h-14 bg-white/50 border-primary/10 rounded-2xl shadow-sm"
                />
                <Button
                  type="submit"
                  disabled={!name.trim() || !joinRoomId.trim()}
                  variant="secondary"
                  className="h-14 px-8 rounded-2xl bg-secondary/10 hover:bg-secondary/20 text-secondary font-medium transition-all"
                >
                  Tham gia
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
