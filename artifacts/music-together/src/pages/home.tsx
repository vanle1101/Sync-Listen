import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateRoom } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Music } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  
  const createRoom = useCreateRoom();

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    createRoom.mutate({ data: { hostName: name.trim() } }, {
      onSuccess: (room) => {
        // Store name in session storage so it can be picked up by the room page
        sessionStorage.setItem("music-together-name", name.trim());
        setLocation(`/room/${room.id}`);
      }
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !joinRoomId.trim()) return;
    
    sessionStorage.setItem("music-together-name", name.trim());
    
    // Handle full URL or just ID
    let id = joinRoomId.trim();
    if (id.includes("/room/")) {
      id = id.split("/room/")[1];
    }
    
    setLocation(`/room/${id}`);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden petal-bg">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-12 items-center z-10 relative">
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
        </div>

        <Card className="bloom-card p-4 relative overflow-hidden border-none">
          <CardHeader className="pb-6 text-center">
            <CardTitle className="text-3xl font-serif text-foreground italic font-medium">Vào phòng</CardTitle>
            <CardDescription className="text-muted-foreground">Nhập tên của bạn để bắt đầu</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground pl-1">Tên của bạn</label>
              <Input 
                placeholder="v.d. Lan Anh" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-14 bg-white/50 border-primary/10 text-lg rounded-2xl focus-visible:ring-primary/30 transition-all shadow-sm"
                autoFocus
              />
            </div>

            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-primary/10" />
                </div>
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

            <div className="space-y-4 pt-2">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-primary/10" />
                </div>
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
