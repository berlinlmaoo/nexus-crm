"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, MapPin, Loader2, ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@supabase/supabase-js";

// Temp browser client fetching only, insertions via API
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CheckInPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [address, setAddress] = useState("Mencari lokasi...");
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  // 1. Fetch Users on Load 
  useEffect(() => {
    async function loadUsers() {
      // Use internal API instead of direct client SDK to bypass row-level security limits
      try {
        const res = await fetch('/api/users');
        const json = await res.json();
        if (json.data) setUsers(json.data);
      } catch (err) {
        console.error("Failed to fetch users");
      }
    }
    loadUsers();
  }, []);

  // 2. Setup Camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" }, 
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied", err);
      }
    }
    setupCamera();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [capturedImage]);

  // 3. Get Geolocation
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setAddress(`${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`);
        },
        (error) => {
          setAddress("Akses lokasi dibatasi oleh browser.");
        },
        { enableHighAccuracy: true }
      );
    } else {
      setAddress("Browser tidak mendukung GPS.");
    }
  }, []);

  const takeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx?.drawImage(videoRef.current, 0, 0);
      
      const base64Img = canvasRef.current.toDataURL("image/jpeg", 0.7);
      setCapturedImage(base64Img);
    }
  };

  const retake = () => {
    setCapturedImage(null);
  };

  const submitAttendance = async (type: "IN" | "OUT") => {
    if (!selectedUser) {
      alert("Harap pilih nama Anda terlebih dahulu.");
      return;
    }
    if (!capturedImage) {
      alert("Tolong ambil foto selfie absensi!");
      return;
    }

    setStatus("submitting");

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUser,
          check_type: type,
          latitude: location?.lat,
          longitude: location?.lng,
          photo_base64: capturedImage
        })
      });

      const body = await res.json();

      if (!res.ok) throw new Error(body.error);

      setStatus("success");
      setFeedback(`Absensi ${type} Sukses! Status kehadiran: ${body.status}`);

      setTimeout(() => {
        router.push("/attendance");
        router.refresh();
      }, 2000);

    } catch (e: any) {
      setStatus("error");
      setFeedback(e.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-stone-500">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Live Absensi</h2>
          <p className="text-sm text-stone-500 mt-1">Sistem Face Capture & Geofencing otomatis.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        {status === "success" ? (
          <div className="p-16 text-center">
            <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-50">
              <span className="text-4xl">🎉</span>
            </div>
            <h3 className="text-2xl font-black text-stone-800">{feedback}</h3>
            <p className="text-stone-500 mt-2">Mengarahkan ke log absensi...</p>
          </div>
        ) : (
          <div className="p-6 md:p-8 space-y-6">
            
            {/* Identity Selector */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700 uppercase tracking-wider">Identitas Diri</label>
              <select 
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-stone-50 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-bold text-stone-800 outline-none"
              >
                <option value="" disabled>-- Pilih Nama Staf --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            {/* Camera Frame */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700 uppercase tracking-wider">Face Capture</label>
              <div className="relative aspect-square md:aspect-video w-full bg-stone-900 rounded-2xl overflow-hidden border-2 border-stone-200 shadow-inner">
                {!capturedImage ? (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover mirror-mode"
                      style={{ transform: "scaleX(-1)" }}
                    ></video>
                    
                    {/* Face Guide Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-full mix-blend-overlay"></div>
                    </div>

                    <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                      <Button onClick={takeSnapshot} className="h-16 w-16 rounded-full bg-white text-emerald-600 hover:bg-stone-100 shadow-xl border-4 border-stone-300 flex items-center justify-center p-0">
                        <Camera className="h-6 w-6" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <img src={capturedImage} alt="Snapshot" className="w-full h-full object-cover" />
                    <div className="absolute top-4 right-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                      OK
                    </div>
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                      <Button onClick={retake} variant="secondary" className="font-bold bg-white/90 backdrop-blur shadow-xl hover:bg-white text-stone-800">
                        Ambil Ulang
                      </Button>
                    </div>
                  </>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            {/* Geolocation Status */}
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 flex items-start gap-3">
              <MapPin className={`h-5 w-5 mt-0.5 ${location ? "text-emerald-500" : "text-amber-500"}`} />
              <div>
                <p className="text-sm font-bold text-stone-800">Status Lokasi (Geofencing)</p>
                <p className="text-xs text-stone-500 font-medium mt-1">{address}</p>
                {location && <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide mt-1">Sinyal GPS Optimal</p>}
              </div>
            </div>

            {status === "error" && <p className="text-red-500 text-sm font-bold p-3 bg-red-50 border border-red-100 rounded-lg">{feedback}</p>}

            <div className="grid grid-cols-2 gap-3 pt-4">
              <Button 
                onClick={() => submitAttendance("IN")}
                disabled={status === "submitting" || !capturedImage || !selectedUser} 
                className="h-14 font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/20 text-base"
              >
                {status === "submitting" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Check IN"}
              </Button>
              <Button 
                onClick={() => submitAttendance("OUT")}
                disabled={status === "submitting" || !capturedImage || !selectedUser} 
                className="h-14 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 text-base"
              >
                {status === "submitting" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Check OUT"}
              </Button>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
