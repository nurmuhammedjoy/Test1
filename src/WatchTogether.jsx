import { useCallback, useEffect, useRef, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Shield, 
  FileVideo, 
  Copy, 
  Check, 
  Lock, 
  ChevronRight,
} from 'lucide-react';

// Initialize Firebase configuration using environment globals
// Replace the internal window configuration check with your actual Firebase project keys:
//
const firebaseConfig = {
    apiKey: "AIzaSyD2RHIxMmJPv5j9IKP68ZEVbfrhgQ8uSBg",
    authDomain: "watch2together-7cbdc.firebaseapp.com",
    projectId: "watch2together-7cbdc",
    storageBucket: "watch2together-7cbdc.firebasestorage.app",
    messagingSenderId: "209468285856",
    appId: "1:209468285856:web:5a33ad395efc2cb0c33ac5",
    measurementId: "G-GL236BNS3K"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = globalThis.__app_id ?? 'watch-together-local';

export default function App() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState('hangout-01');
  const [inputRoomId, setInputRoomId] = useState('hangout-01');
  const [isJoined, setIsJoined] = useState(false);
  
  // Roles: 'admin' or 'viewer'
  const [role, setRole] = useState('viewer');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [inputPasscode, setInputPasscode] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

  // Video State
  const [videoSourceType, setVideoSourceType] = useState('file'); // 'file' or 'url'
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [resolvedVideoSrc, setResolvedVideoSrc] = useState('');
  
  // Player UI states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState('ONLINE'); // 'ONLINE', 'SYNCING', 'STANDBY'
  
  // Active Room State (from DB)
  const [roomData, setRoomData] = useState(null);

  // Refs
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const lastUpdateSentRef = useRef(0);
  const lastRemoteSourceKeyRef = useRef('');

  // Custom Minimalist Notification / Banner
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const showToast = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  }, []);

  const applyPlaybackState = useCallback((data) => {
    if (!videoRef.current) return false;

    const video = videoRef.current;

    // 2. Playback State Syncing (Play / Pause)
    if (data.playing && video.paused) {
      video.play().catch(() => {
        showToast("Press anywhere to enable sound & join playback.", "info");
      });
      setIsPlaying(true);
    } else if (!data.playing && !video.paused) {
      video.pause();
      setIsPlaying(false);
    }

    // 3. Timeline Sync (Seek)
    const timeDiff = Math.abs(video.currentTime - data.currentTime);
    if (timeDiff > 1.8) {
      video.currentTime = data.currentTime;
      setCurrentTime(data.currentTime);
    }

    return true;
  }, [showToast]);

  // Handle incoming remote states safely to prevent feedback jitter
  const handleRemoteStateChange = useCallback((data) => {
    // Skip if this update was triggered by our own changes
    if (data.lastUpdatedBy === user?.uid) {
      return;
    }

    setSyncStatus('SYNCING');

    // 1. Sync Video Metadata/Source Requirements
    if (data.videoSourceType === 'url') {
      const nextSourceKey = `url:${data.videoUrl || ''}`;
      const sourceChanged = lastRemoteSourceKeyRef.current !== nextSourceKey;
      setVideoSourceType('url');
      setVideoUrl(data.videoUrl || '');
      setResolvedVideoSrc(data.videoUrl || '');
      if (sourceChanged) {
        showToast("Video Source Update Received.", "info");
        lastRemoteSourceKeyRef.current = nextSourceKey;
      }
    } else if (data.videoSourceType === 'file') {
      const nextSourceKey = `file:${data.videoName || ''}:${data.videoSize || 0}`;
      const sourceChanged = lastRemoteSourceKeyRef.current !== nextSourceKey;
      setVideoSourceType('file');
      // Viewer needs to load the matching file
      if (role === 'viewer' && (data.videoName !== selectedFile?.name || data.videoSize !== selectedFile?.size)) {
        setResolvedVideoSrc('');
        if (sourceChanged) {
          showToast(`Need the matching file: "${data.videoName}".`, "warning");
        }
      }
      if (sourceChanged) {
        lastRemoteSourceKeyRef.current = nextSourceKey;
      }
    }

    if (!videoRef.current) {
      setTimeout(() => {
        setSyncStatus('ONLINE');
      }, 500);
      return;
    }

    applyPlaybackState(data);

    setTimeout(() => {
      setSyncStatus('ONLINE');
    }, 500);
  }, [applyPlaybackState, role, selectedFile?.name, selectedFile?.size, showToast, user?.uid]);

  useEffect(() => {
    if (!roomData || !resolvedVideoSrc || !videoRef.current) return;
    applyPlaybackState(roomData);
  }, [applyPlaybackState, roomData, resolvedVideoSrc]);

  // --- 1. Authentication (Rule 3) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        const initialAuthToken = globalThis.__initial_auth_token;
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
        setUser({ uid: 'local-session' });
        showToast("Authentication unavailable. Running local session.", "warning");
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, [showToast]);

  // --- 2. Firestore Sync Subscriptions ---
  useEffect(() => {
    if (!user || !isJoined) return;

    // Room path adhering to RULE 1
    const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);

    const unsubscribe = onSnapshot(roomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomData(data);
        handleRemoteStateChange(data);
      } else {
        // Initialize room if it doesn't exist yet
        if (role === 'admin' && isAdminUnlocked) {
          setDoc(roomDocRef, {
            playing: false,
            currentTime: 0,
            videoSourceType: 'file',
            videoName: '',
            videoSize: 0,
            videoUrl: '',
            lastUpdatedBy: user.uid,
            updatedAt: serverTimestamp(),
            adminPasscode: adminPasscode || '1234'
          });
        }
      }
    }, (error) => {
      console.error("Firestore error:", error);
      showToast("Connection dropped. Re-establishing link...", "error");
    });

    return () => unsubscribe();
  }, [user, isJoined, roomId, role, isAdminUnlocked, adminPasscode, handleRemoteStateChange, showToast]);

  // --- 3. Push Local Controls to Firestore (Admin Only) ---
  const updateRoomStateInDB = async (payload) => {
    if (!user || role !== 'admin' || !isAdminUnlocked) return;

    try {
      const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
      await setDoc(roomDocRef, {
        ...payload,
        lastUpdatedBy: user.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Error writing sync state:", err);
    }
  };

  const pushSeekState = (time) => {
    const now = Date.now();
    if (now - lastUpdateSentRef.current > 200) {
      updateRoomStateInDB({
        currentTime: time,
        playing: isPlaying
      });
      lastUpdateSentRef.current = now;
    }
  };

  // --- 4. User Event Handlers ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setVideoSourceType('file');
    const localUrl = URL.createObjectURL(file);
    setResolvedVideoSrc(localUrl);
    lastRemoteSourceKeyRef.current = `file:${file.name}:${file.size}`;

    if (role === 'admin' && isAdminUnlocked) {
      updateRoomStateInDB({
        videoSourceType: 'file',
        videoName: file.name,
        videoSize: file.size,
        videoUrl: '',
        currentTime: 0,
        playing: false
      });
    }
    showToast(`Loaded file: ${file.name}`, "info");
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;

    setVideoSourceType('url');
    setResolvedVideoSrc(videoUrl);
    lastRemoteSourceKeyRef.current = `url:${videoUrl}`;
    if (role === 'admin' && isAdminUnlocked) {
      updateRoomStateInDB({
        videoSourceType: 'url',
        videoName: '',
        videoSize: 0,
        videoUrl: videoUrl,
        currentTime: 0,
        playing: false
      });
    }
    showToast("Loaded stream link.", "info");
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (role !== 'admin') {
      showToast("Host access needed for that.", "error");
      return;
    }

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      updateRoomStateInDB({ playing: false, currentTime: videoRef.current.currentTime });
    } else {
      videoRef.current.play().catch(e => console.log(e));
      setIsPlaying(true);
      updateRoomStateInDB({ playing: true, currentTime: videoRef.current.currentTime });
    }
  };

  const handleSeek = (e) => {
    if (!videoRef.current) return;
    
    if (role !== 'admin') {
      showToast("Timeline is host-only.", "error");
      return;
    }

    const seekTime = parseFloat(e.target.value);
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
    pushSeekState(seekTime);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    
    if (role === 'admin' && isPlaying) {
      const now = Date.now();
      if (now - lastUpdateSentRef.current > 3000) {
        updateRoomStateInDB({
          currentTime: videoRef.current.currentTime,
          playing: true
        });
        lastUpdateSentRef.current = now;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (role === 'admin') {
      updateRoomStateInDB({ playing: false, currentTime: 0 });
    }
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      videoRef.current.muted = vol === 0;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    videoRef.current.muted = nextMute;
    if (nextMute) {
      setVolume(0);
    } else {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;

    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {
        showToast("Fullscreen disabled by browser.", "error");
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Toggle controls on click/tap (helps mobile users toggle controls panel cleanly)
  const handlePlayerTap = (e) => {
    // Avoid toggling controls when tapping on the actual overlay buttons
    if (e.target.closest('input') || e.target.closest('button')) {
      return;
    }
    handleMouseMove();
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 4000); // 4 seconds control timeout for comfortable mobile reading
    }
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "00:00:00";
    const hrs = Math.floor(timeInSeconds / 3600);
    const mins = Math.floor((timeInSeconds % 3600) / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  const joinRoom = () => {
    if (!inputRoomId.trim()) return;
    setRoomId(inputRoomId.trim().toUpperCase());
    setIsJoined(true);
    showToast(`Joined room: ${inputRoomId.toUpperCase()}`, "info");
  };

  const handleAdminAuth = () => {
    if (roomData && roomData.adminPasscode) {
      if (inputPasscode === roomData.adminPasscode) {
        setRole('admin');
        setIsAdminUnlocked(true);
        showToast("Host key unlocked.", "info");
      } else {
        showToast("Wrong code.", "error");
      }
    } else {
      if (!adminPasscode.trim()) {
        showToast("Set a host code first.", "warning");
        return;
      }
      setRole('admin');
      setIsAdminUnlocked(true);
      showToast("Host code saved.", "info");
    }
  };

  const copyRoomLink = () => {
    const tempInput = document.createElement('input');
    tempInput.value = roomId;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    
    setCopied(true);
    showToast("Room code copied.", "info");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col font-mono tracking-tight selection:bg-orange-500 selection:text-black">
      
      {/* Toast Alert Interface */}
      {toast.show && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:top-6 sm:bottom-auto sm:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-none border text-[11px] font-semibold uppercase bg-neutral-900 border-neutral-700 text-neutral-200 shadow-xl max-w-full sm:max-w-md">
          <span className="w-1.5 h-1.5 bg-orange-500 animate-pulse flex-shrink-0"></span>
          <span className="break-all">{toast.message}</span>
        </div>
      )}

      {/* Header Panel */}
      <header className="border-b border-neutral-900 bg-neutral-950 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

          {isJoined && (
            <div className="flex flex-wrap items-stretch gap-2 text-[10px] sm:text-xs w-full md:w-auto">
              <div className="flex items-center h-9 sm:h-10 border border-neutral-800 bg-neutral-900 px-2 sm:px-3 flex-1 sm:flex-initial justify-between">
                <div>
                  <span className="text-neutral-500 mr-1 sm:mr-2">ROOM</span>
                  <span className="text-neutral-100 font-bold">{roomId}</span>
                </div>
                <button onClick={copyRoomLink} className="ml-2 hover:text-orange-500 transition-colors p-0.5">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center h-9 sm:h-10 border border-neutral-800 bg-neutral-900 px-3">
                <span className="text-neutral-500 mr-2">SYNC</span>
                <span className={`font-bold ${syncStatus === 'ONLINE' ? 'text-emerald-500' : 'text-orange-500'}`}>
                  {syncStatus}
                </span>
              </div>

              <div className={`h-9 sm:h-10 px-3 flex items-center justify-center font-bold text-center ${
                role === 'admin' ? 'bg-orange-600 text-black' : 'border border-neutral-800 text-neutral-400'
              }`}>
                {role === 'admin' ? 'HOST' : 'GUEST'}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Panel Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        
        {!isJoined ? (
          /* PORTAL ACCESS */
          <div className="col-span-12 max-w-md mx-auto w-full py-12 sm:py-16">
            <div className="border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
              <div className="mb-6 border-b border-neutral-900 pb-4">
                <h2 className="text-xs sm:text-sm font-bold text-neutral-100 tracking-widest uppercase">JUMP IN</h2>
                <p className="text-[10px] text-neutral-500 mt-1 uppercase">Drop the room code</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Room code</label>
                  <input 
                    type="text" 
                    value={inputRoomId}
                    onChange={(e) => setInputRoomId(e.target.value)}
                    placeholder="hangout-01"
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-neutral-500 rounded-none px-3 py-2.5 text-xs text-white placeholder-neutral-700 focus:outline-none transition-colors"
                  />
                </div>

                <button 
                  onClick={joinRoom}
                  className="w-full h-11 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-black font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                >
                  Join room <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* CINEMA PLAYSPACE WORKSPACE */
          <>
            {/* COLUMN LEFT: Main Monitor & Controller Mounting */}
            <div className="lg:col-span-8 flex flex-col gap-5 sm:gap-6">
              
              {/* VIDEO MONITOR FRAME */}
              <div 
                ref={playerContainerRef}
                onMouseMove={handleMouseMove}
                onClick={handlePlayerTap}
                className="relative bg-neutral-950 border border-neutral-800 aspect-video overflow-hidden group flex flex-col justify-between select-none"
              >
                {resolvedVideoSrc ? (
                  <>
                    <video
                      ref={videoRef}
                      key={resolvedVideoSrc}
                      src={resolvedVideoSrc}
                      preload="metadata"
                      playsInline
                      className="w-full h-full object-contain bg-black"
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onEnded={handleVideoEnded}
                    />

                    {/* Shield overlay blocking interactive video taps directly from standard viewer */}
                    {role !== 'admin' && (
                      <div className="absolute inset-0 z-10" />
                    )}

                    {/* Controls Overlay Bottom HUD */}
                    <div className={`absolute inset-x-0 bottom-0 bg-neutral-950/95 border-t border-neutral-800 p-2.5 sm:p-4 transition-all duration-300 z-20 flex flex-col gap-2.5 sm:gap-3 ${
                      showControls ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none'
                    }`}>
                      
                      {/* Interactive Time Track */}
                        <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 min-w-[50px]">{formatTime(currentTime)}</span>
                        
                        <input 
                          type="range" 
                          min="0"
                          max={duration || 100}
                          value={currentTime}
                          onChange={handleSeek}
                          disabled={role !== 'admin'}
                          className="flex-1 accent-orange-600 bg-neutral-800 h-2 sm:h-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />

                        <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 min-w-[50px] text-right">{formatTime(duration)}</span>
                      </div>

                      {/* Device Action Console Row */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4">
                        
                        <div className="flex items-center justify-between sm:justify-start gap-4">
                          {role === 'admin' ? (
                            <button 
                              onClick={togglePlay} 
                              className="h-9 sm:h-10 px-2.5 sm:px-3 border border-neutral-800 hover:border-neutral-500 bg-neutral-900 text-[10px] sm:text-xs font-bold text-neutral-100 hover:text-orange-500 transition-colors flex items-center gap-1.5 uppercase min-w-[72px] sm:min-w-[85px] justify-center"
                            >
                              {isPlaying ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5 fill-current" /> Play</>}
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 text-neutral-500 text-[9px] sm:text-[10px] font-bold uppercase py-1.5">
                              <Lock className="w-3.5 h-3.5" /> Viewer mode
                            </div>
                          )}

                          <div className="hidden sm:block h-5 w-px bg-neutral-800"></div>

                          {/* Sound Slider */}
                          <div className="flex items-center gap-2">
                            <button onClick={toggleMute} className="text-neutral-400 hover:text-neutral-200 transition-colors p-1.5 sm:p-2 hover:bg-neutral-900 border border-transparent hover:border-neutral-800">
                              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                            <input 
                              type="range" 
                              min="0" 
                              max="1" 
                              step="0.05"
                              value={volume}
                              onChange={handleVolumeChange}
                              className="w-14 sm:w-20 accent-neutral-300 bg-neutral-800 h-1 cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Right aligned details & Fullscreen trigger */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 text-[8px] sm:text-[10px] text-neutral-500 font-bold uppercase border-t border-neutral-900 sm:border-0 pt-2 sm:pt-0">
                          <span>FRAME SYNC: OK</span>
                          <button
                            onClick={toggleFullscreen}
                            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                            className="text-neutral-400 hover:text-neutral-100 transition-colors p-1.5 sm:p-2 border border-neutral-800 sm:border-0 bg-neutral-900 sm:bg-transparent"
                          >
                            <Maximize className="w-4 h-4" />
                          </button>
                        </div>

                      </div>

                    </div>
                  </>
                ) : (
                  /* PHYSICAL SCREEN OFF (NOT MOUNTED) */
                  <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-4 bg-neutral-950">
                    <div className="w-10 h-10 border border-neutral-800 flex items-center justify-center text-neutral-600 mb-3 font-black text-xs select-none">
                      ST
                    </div>
                    <h3 className="text-[10px] sm:text-xs font-bold text-neutral-200 uppercase tracking-widest">No media loaded</h3>
                    {role === 'admin' ? (
                      <p className="text-[9px] text-neutral-500 mt-2 max-w-xs uppercase leading-normal">
                        Drop in a file or paste a link below to start the room.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2 max-w-xs w-full px-2">
                        <p className="text-[9px] text-neutral-500 uppercase leading-normal">
                          Waiting on the host to load something.
                        </p>
                        {roomData?.videoName && (
                          <div className="border border-neutral-800 bg-neutral-900 p-2.5 text-left">
                            <span className="text-[8px] text-neutral-500 uppercase block">Local file to match</span>
                            <span className="text-[9px] sm:text-[10px] text-orange-500 font-bold block truncate mt-1">{roomData.videoName}</span>
                            <span className="text-[8px] text-neutral-400 block mt-1 uppercase">Use the same file below to sync up.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MEDIA PANEL DECK */}
              <div className="border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-neutral-900 pb-3 mb-4">
                  <h3 className="text-[10px] sm:text-xs font-bold text-neutral-100 uppercase tracking-wider">Source</h3>
                  <span className="text-[8px] sm:text-[9px] text-neutral-500 uppercase">Input</span>
                </div>

                <div className="flex gap-2 border-b border-neutral-900 pb-4 mb-4">
                  <button 
                    onClick={() => setVideoSourceType('file')}
                    className={`flex-1 sm:flex-initial px-4 py-2.5 text-[10px] sm:text-xs font-bold uppercase transition-all border ${
                      videoSourceType === 'file' 
                        ? 'bg-neutral-100 text-black border-neutral-100' 
                        : 'border-neutral-850 text-neutral-400 hover:text-neutral-200 hover:border-neutral-800'
                    }`}
                  >
                     Local file
                   </button>
                  <button 
                    onClick={() => setVideoSourceType('url')}
                    disabled={role !== 'admin'}
                    className={`flex-1 sm:flex-initial px-4 py-2.5 text-[10px] sm:text-xs font-bold uppercase transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
                      videoSourceType === 'url' 
                        ? 'bg-neutral-100 text-black border-neutral-100' 
                        : 'border-neutral-850 text-neutral-400 hover:text-neutral-200 hover:border-neutral-800'
                    }`}
                  >
                     Link
                   </button>
                </div>

                {videoSourceType === 'file' ? (
                  <div className="space-y-4">
                    <div className="border border-neutral-800 bg-neutral-900 hover:bg-neutral-850 p-5 sm:p-6 text-center cursor-pointer relative transition-colors">
                      <input 
                        type="file" 
                        accept="video/*" 
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="space-y-2 pointer-events-none">
                        <FileVideo className="w-5 h-5 text-neutral-500 mx-auto" />
                        <p className="text-[10px] text-neutral-200 uppercase font-bold break-all">
                          {selectedFile ? `File: ${selectedFile.name}` : "Drop a video file"}
                        </p>
                        <p className="text-[8px] text-neutral-500 uppercase">
                          No uploads. Just a local file.
                        </p>
                      </div>
                    </div>

                    {role === 'viewer' && roomData?.videoName && (
                      <div className="border border-neutral-800 bg-neutral-900 p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-1.5 h-1.5 bg-orange-500"></span>
                           <span className="text-[8px] sm:text-[9px] font-bold text-neutral-300 uppercase">Match this file</span>
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-neutral-400 leading-normal uppercase">
                          Use the same local file to keep time in step:
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-orange-500 font-bold bg-neutral-950 border border-neutral-800 p-2.5 mt-2 break-all font-mono select-all">
                          {roomData.videoName}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleUrlSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[8px] sm:text-[9px] font-bold text-neutral-500 uppercase mb-2">Direct video link</label>
                      <input 
                        type="url" 
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="http://192.168.1.50:8080/movie.mp4"
                        disabled={role !== 'admin'}
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-neutral-500 rounded-none px-3 py-2.5 text-xs text-white placeholder-neutral-700 focus:outline-none transition-colors disabled:opacity-50"
                      />
                    </div>
                    {role === 'admin' && (
                      <button 
                        type="submit" 
                        className="w-full h-9 sm:h-10 border border-neutral-850 hover:border-neutral-750 bg-neutral-900 hover:bg-neutral-850 text-neutral-200 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider transition-colors"
                      >
                        Send to room
                      </button>
                    )}
                  </form>
                )}

              </div>

            </div>

            {/* COLUMN RIGHT: Administration & Protocols */}
            <div className="lg:col-span-4 flex flex-col gap-5 sm:gap-6">
              
              {/* ACCESSIBILITY LOCK UNIT */}
              <div className="border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-neutral-900 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                    <h3 className="text-[10px] sm:text-xs font-bold text-neutral-100 uppercase tracking-wider">Host lock</h3>
                  </div>
                  <span className={`text-[8px] sm:text-[9px] font-bold px-2 py-0.5 ${
                    isAdminUnlocked ? 'bg-orange-600 text-black' : 'bg-neutral-900 text-neutral-500'
                  }`}>
                    {isAdminUnlocked ? 'HOST' : 'GUEST'}
                  </span>
                </div>

                {!isAdminUnlocked ? (
                  <div className="space-y-4">
                      <p className="text-[9px] sm:text-[10px] text-neutral-500 leading-normal uppercase">
                        Timeline and playback are locked. Grab host access to steer the room.
                      </p>

                    {roomData?.adminPasscode ? (
                      /* Unlock Room passcode */
                      <div className="space-y-3">
                        <div>
                           <label className="block text-[8px] sm:text-[9px] font-bold text-neutral-500 uppercase mb-1.5">Enter host code</label>
                          <input 
                            type="password" 
                            value={inputPasscode}
                            onChange={(e) => setInputPasscode(e.target.value)}
                            placeholder="••••••"
                            className="w-full bg-neutral-900 border border-neutral-800 focus:border-neutral-500 rounded-none px-3 py-2.5 text-xs text-white focus:outline-none transition-colors"
                          />
                        </div>
                        <button 
                          onClick={handleAdminAuth}
                           className="w-full h-9 sm:h-10 bg-neutral-100 hover:bg-neutral-200 text-black font-bold text-[9px] sm:text-[10px] uppercase transition-colors"
                          >
                           Unlock host mode
                         </button>
                      </div>
                    ) : (
                      /* Set Passcode first time */
                      <div className="space-y-3">
                        <div>
                           <label className="block text-[8px] sm:text-[9px] font-bold text-neutral-500 uppercase mb-1.5">Set host code</label>
                          <input 
                            type="password" 
                            value={adminPasscode}
                            onChange={(e) => setAdminPasscode(e.target.value)}
                            placeholder="e.g. 1234"
                            className="w-full bg-neutral-900 border border-neutral-800 focus:border-neutral-500 rounded-none px-3 py-2.5 text-xs text-white focus:outline-none transition-colors"
                          />
                        </div>
                        <button 
                          onClick={handleAdminAuth}
                           className="w-full h-9 sm:h-10 bg-neutral-100 hover:bg-neutral-200 text-black font-bold text-[9px] sm:text-[10px] uppercase transition-colors"
                          >
                           Save host mode
                         </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border border-orange-500/30 bg-orange-950/25 p-3">
                       <span className="text-[8px] sm:text-[9px] font-bold text-orange-500 uppercase block mb-1">Host mode on</span>
                       <p className="text-[9px] sm:text-[10px] text-neutral-300 leading-normal uppercase">
                         Playback changes will roll out to everyone in the room.
                       </p>
                    </div>

                    <button 
                      onClick={() => {
                        setRole('viewer');
                        setIsAdminUnlocked(false);
                        showToast("Host mode off.", "info");
                      }}
                       className="w-full h-9 sm:h-10 border border-neutral-800 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 text-[9px] sm:text-[10px] uppercase transition-colors"
                      >
                       Step back
                      </button>
                  </div>
                )}
              </div>

            </div>
          </>
        )}

      </main>

      {/* Footer Frame */}
      <footer className="border-t border-neutral-900 bg-neutral-950 px-6 py-6 mt-auto text-center text-[8px] sm:text-[9px] text-neutral-600 uppercase tracking-widest">
        <span>made in home</span>
      </footer>

    </div>
  );
}
