import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from './components/Toast';
import JoinScreen from './components/JoinScreen';
import RoomHeader from './components/RoomHeader';
import VideoPlayer from './components/VideoPlayer';
import Playlist from './components/Playlist';
import HostLock from './components/HostLock';
import { useToast } from './hooks/useToast';
import { useAuth } from './hooks/useAuth';
import { useRoomSync } from './hooks/useRoomSync';
import { usePlaylist } from './hooks/usePlaylist';

// How close local and host playback need to drift before we force a seek.
// Below this, small network jitter wouldn't be worth the visible jump-cut.
const SEEK_TOLERANCE_SECONDS = 1.8;
const SEEK_PUSH_THROTTLE_MS = 200;
const PERIODIC_PUSH_THROTTLE_MS = 3000;
const CONTROLS_HIDE_DELAY_MS = 4000;

export default function WatchTogether() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState('hangout-01');
  const [inputRoomId, setInputRoomId] = useState('hangout-01');
  const [isJoined, setIsJoined] = useState(false);

  // Roles: 'admin' (host, can drive playback) or 'viewer' (watches along)
  const [role, setRole] = useState('viewer');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [inputPasscode, setInputPasscode] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

  // Player UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState('ONLINE'); // ONLINE | SYNCING

  // Latest snapshot of the room doc from Firestore
  const [roomData, setRoomData] = useState(null);
  const videoSrc = roomData?.videoUrl || '';

  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const syncResetTimeoutRef = useRef(null);
  // Two separate throttle clocks — a seek and a periodic heartbeat used to
  // step on each other's toes when they shared one ref (a seek right after
  // a heartbeat would get silently dropped).
  const seekThrottleRef = useRef(0);
  const periodicThrottleRef = useRef(0);
  const lastRemoteVideoUrlRef = useRef('');

  const { toast, showToast } = useToast();
  const playlist = usePlaylist();

  useAuth({ setUser, showToast });

  // Pushes the host's video element into sync after a remote update —
  // play/pause state first, then a coarse timeline correction.
  const applyPlaybackState = useCallback(
    (data) => {
      const video = videoRef.current;
      if (!video) return;

      if (data.playing && video.paused) {
        video.play().catch(() => {
          showToast('Press anywhere to enable sound & join playback.', 'info');
        });
        setIsPlaying(true);
      } else if (!data.playing && !video.paused) {
        video.pause();
        setIsPlaying(false);
      }

      const timeDiff = Math.abs(video.currentTime - data.currentTime);
      if (timeDiff > SEEK_TOLERANCE_SECONDS) {
        video.currentTime = data.currentTime;
        setCurrentTime(data.currentTime);
      }
    },
    [showToast]
  );

  const handleRemoteData = useCallback(
    (data) => {
      setRoomData(data);

      // Skip reacting to the echo of our own write — we already applied it.
      if (data.lastUpdatedBy === user?.uid) return;

      setSyncStatus('SYNCING');

      if (data.videoUrl && data.videoUrl !== lastRemoteVideoUrlRef.current) {
        showToast('Video source updated.', 'info');
      }
      lastRemoteVideoUrlRef.current = data.videoUrl || '';

      applyPlaybackState(data);

      clearTimeout(syncResetTimeoutRef.current);
      syncResetTimeoutRef.current = setTimeout(() => setSyncStatus('ONLINE'), 500);
    },
    [applyPlaybackState, showToast, user?.uid]
  );

  const { pushRoomState } = useRoomSync({
    user,
    isJoined,
    roomId,
    role,
    isAdminUnlocked,
    adminPasscode,
    onRemoteData: handleRemoteData,
    showToast,
  });

  // Catch a freshly mounted <video> (new src) up to where the room actually is.
  useEffect(() => {
    if (!roomData || !videoSrc || !videoRef.current) return;
    applyPlaybackState(roomData);
  }, [applyPlaybackState, roomData, videoSrc]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // --- Playback controls (host only writes back to the room) ---

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (role !== 'admin') {
      showToast('Host access needed for that.', 'error');
      return;
    }

    const nextPlaying = !isPlaying;
    nextPlaying ? video.play().catch(() => {}) : video.pause();
    setIsPlaying(nextPlaying);
    pushRoomState({ playing: nextPlaying, currentTime: video.currentTime });
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video) return;
    if (role !== 'admin') {
      showToast('Timeline is host-only.', 'error');
      return;
    }

    const seekTime = parseFloat(e.target.value);
    video.currentTime = seekTime;
    setCurrentTime(seekTime);

    const now = Date.now();
    if (now - seekThrottleRef.current > SEEK_PUSH_THROTTLE_MS) {
      pushRoomState({ currentTime: seekTime, playing: isPlaying });
      seekThrottleRef.current = now;
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    if (role === 'admin' && isPlaying) {
      const now = Date.now();
      if (now - periodicThrottleRef.current > PERIODIC_PUSH_THROTTLE_MS) {
        pushRoomState({ currentTime: video.currentTime, playing: true });
        periodicThrottleRef.current = now;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  // Auto-advance: when the host's video finishes, queue the next watchlist
  // item (the one right below the current one in the list) automatically.
  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (role !== 'admin') return;

    const currentIndex = playlist.items.findIndex((item) => item.url === videoSrc);
    const nextItem = currentIndex >= 0 ? playlist.items[currentIndex + 1] : undefined;

    if (nextItem) {
      pushRoomState({ videoUrl: nextItem.url, currentTime: 0, playing: true });
      showToast(`Up next: ${nextItem.title}`, 'info');
    } else {
      pushRoomState({ playing: false, currentTime: 0 });
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
    setVolume(nextMute ? 0 : 0.5);
    if (!nextMute) videoRef.current.volume = 0.5;
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;

    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {
        showToast('Fullscreen disabled by browser.', 'error');
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Keep the control bar visible while interacting, hide it after a pause
  // in activity so the video isn't permanently covered on mobile.
  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_DELAY_MS);
    }
  };

  const handlePlayerTap = (e) => {
    if (e.target.closest('input') || e.target.closest('button')) return;
    handleMouseMove();
  };

  const handlePlayFromPlaylist = (item) => {
    if (role !== 'admin' || !isAdminUnlocked) return;
    pushRoomState({ videoUrl: item.url, currentTime: 0, playing: true });
    showToast(`Loading "${item.title}"`, 'info');
  };

  // --- Room / identity actions ---

  const joinRoom = () => {
    if (!inputRoomId.trim()) return;
    setRoomId(inputRoomId.trim().toUpperCase());
    setIsJoined(true);
    showToast(`Joined room: ${inputRoomId.toUpperCase()}`, 'info');
  };

  const handleAdminAuth = () => {
    if (roomData && roomData.adminPasscode) {
      if (inputPasscode === roomData.adminPasscode) {
        setRole('admin');
        setIsAdminUnlocked(true);
        showToast('Host key unlocked.', 'info');
      } else {
        showToast('Wrong code.', 'error');
      }
      return;
    }

    if (!adminPasscode.trim()) {
      showToast('Set a host code first.', 'warning');
      return;
    }
    setRole('admin');
    setIsAdminUnlocked(true);
    showToast('Host code saved.', 'info');
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      // Clipboard API blocked (older browser / insecure context) — skip silently,
      // the room code is short enough to read off the screen and retype.
    }
    setCopied(true);
    showToast('Room code copied.', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col font-mono tracking-tight selection:bg-orange-500 selection:text-black">
      <Toast toast={toast} />

      <header className="border-b border-neutral-900 bg-neutral-950 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {isJoined && (
            <RoomHeader roomId={roomId} syncStatus={syncStatus} role={role} copied={copied} onCopyRoomId={copyRoomId} />
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {!isJoined ? (
          <JoinScreen inputRoomId={inputRoomId} onChangeRoomId={setInputRoomId} onJoin={joinRoom} />
        ) : (
          <>
            <div className="lg:col-span-8 flex flex-col gap-5 sm:gap-6">
              <VideoPlayer
                playerContainerRef={playerContainerRef}
                videoRef={videoRef}
                videoSrc={videoSrc}
                role={role}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                volume={volume}
                isMuted={isMuted}
                isFullscreen={isFullscreen}
                showControls={showControls}
                onMouseMove={handleMouseMove}
                onPlayerTap={handlePlayerTap}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleVideoEnded}
                onTogglePlay={togglePlay}
                onSeek={handleSeek}
                onToggleMute={toggleMute}
                onVolumeChange={handleVolumeChange}
                onToggleFullscreen={toggleFullscreen}
              />

              <Playlist
                items={playlist.items}
                currentUrl={videoSrc}
                canControlRoom={role === 'admin' && isAdminUnlocked}
                onAdd={playlist.addItem}
                onRemove={playlist.removeItem}
                onPlay={handlePlayFromPlaylist}
                showToast={showToast}
              />
            </div>

            <div className="lg:col-span-4 flex flex-col gap-5 sm:gap-6">
              <HostLock
                isAdminUnlocked={isAdminUnlocked}
                hasStoredPasscode={Boolean(roomData?.adminPasscode)}
                inputPasscode={inputPasscode}
                onChangeInputPasscode={setInputPasscode}
                adminPasscode={adminPasscode}
                onChangeAdminPasscode={setAdminPasscode}
                onSubmit={handleAdminAuth}
                onStepBack={() => {
                  setRole('viewer');
                  setIsAdminUnlocked(false);
                  showToast('Host mode off.', 'info');
                }}
              />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-neutral-900 bg-neutral-950 px-6 py-6 mt-auto text-center text-[8px] sm:text-[9px] text-neutral-600 uppercase tracking-widest">
        <span>made in home</span>
      </footer>
    </div>
  );
}
