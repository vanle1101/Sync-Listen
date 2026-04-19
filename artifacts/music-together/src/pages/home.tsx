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
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/20 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center z-10 relative">
        <div className="space-y-6 text-center md:text-left">
          <div className="inline-flex items-center justify-center p-3 bg-white/5 rounded-2xl border border-white/10 mb-4 shadow-2xl backdrop-blur-sm neon-glow">
            <Music className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white leading-tight">
            Listen <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Together.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto md:mx-0">
            A lively, social listening space. Create a room, invite your friends, and share music in perfect sync.
          </p>
        </div>

        <Card className="glass-panel border-white/10 shadow-2xl bg-black/40 p-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary"></div>
          
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold">Enter the Room</CardTitle>
            <CardDescription>Choose a name to get started</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-8">
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider pl-1">Your Name</label>
              <Input 
                placeholder="E.g. Alex" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 bg-black/50 border-white/10 text-lg rounded-xl focus-visible:ring-primary"
                autoFocus
              />
            </div>

            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card/40 px-2 text-muted-foreground font-mono">Create</span>
                </div>
              </div>
              
              <Button 
                onClick={handleCreateRoom} 
                disabled={!name.trim() || createRoom.isPending}
                className="w-full h-12 text-md font-bold rounded-xl bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(178,0,255,0.4)] transition-all hover:shadow-[0_0_25px_rgba(178,0,255,0.6)]"
              >
                {createRoom.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create New Room"}
              </Button>
            </div>

            <div className="space-y-4 pt-2">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card/40 px-2 text-muted-foreground font-mono">Or Join</span>
                </div>
              </div>
              
              <form onSubmit={handleJoinRoom} className="flex gap-2">
                <Input 
                  placeholder="Room link or ID" 
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="h-12 bg-black/50 border-white/10 rounded-xl"
                />
                <Button 
                  type="submit" 
                  disabled={!name.trim() || !joinRoomId.trim()}
                  variant="secondary"
                  className="h-12 px-6 rounded-xl bg-white/10 hover:bg-white/20"
                >
                  Join
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
