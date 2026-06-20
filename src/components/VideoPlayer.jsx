import { Lock, Maximize, Minimize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { formatTime } from '../lib/time';

export default function VideoPlayer({
  playerContainerRef,
  videoRef,
  videoSrc,
  role,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isFullscreen,
  showControls,
  onMouseMove,
  onPlayerTap,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onTogglePlay,
  onSeek,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
}) {
  const isAdmin = role === 'admin';

  return (
    <div
      ref={playerContainerRef}
      onMouseMove={onMouseMove}
      onClick={onPlayerTap}
      className="relative bg-neutral-950 border border-neutral-800 aspect-video overflow-hidden group flex flex-col justify-between select-none rounded-none"
    >
      {videoSrc ? (
        <>
          <video
            ref={videoRef}
            key={videoSrc}
            src={videoSrc}
            preload="metadata"
            playsInline
            className="w-full h-full object-contain bg-black"
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
            onEnded={onEnded}
          />

          {/* Block direct taps for viewers to prevent desyncing from host */}
          {!isAdmin && <div className="absolute inset-0 z-10" />}

          {/* Compact Control Bar (Flat, Square, Overlay) */}
          <div
            className={`absolute inset-x-0 bottom-0 bg-neutral-950/95 border-t border-neutral-800 p-2 sm:p-3 transition-all duration-300 z-20 flex flex-col gap-2 ${
              showControls ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0 pointer-events-none'
            }`}
          >
            {/* Row 1: Timeline Slider (Completely Square Tracks and Thumbs) */}
            <div className="flex items-center gap-2.5 w-full">
              <span className="text-[10px] font-mono font-bold text-neutral-400 min-w-[34px] text-left">
                {formatTime(currentTime)}
              </span>
              
              <div className="flex-1 relative flex items-center h-4">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={onSeek}
                  disabled={!isAdmin}
                  className="w-full accent-orange-600 bg-neutral-800 h-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed appearance-none rounded-none"
                  style={{
                    background: `linear-gradient(to right, #ea580c 0%, #ea580c ${(currentTime / (duration || 100)) * 100}%, #262626 ${(currentTime / (duration || 100)) * 100}%, #262626 100%)`
                  }}
                />
              </div>

              <span className="text-[10px] font-mono font-bold text-neutral-400 min-w-[34px] text-right">
                {formatTime(duration)}
              </span>
            </div>

            {/* Row 2: Actions & Status */}
            <div className="flex items-center justify-between gap-4 h-8">

              {/* Left Side: Playback & Volume */}
              <div className="flex items-center gap-3">
                {isAdmin ? (
                  <button
                    onClick={onTogglePlay}
                    className="h-6 w-6 bg-orange-600 hover:bg-orange-500 text-white transition-colors flex items-center justify-center border border-orange-700 active:bg-orange-700 rounded-none"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="w-3 h-3 fill-current text-white" />
                    ) : (
                      <Play className="w-3 h-3 fill-current text-white " />
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider rounded-none">
                    <Lock className="w-3 h-3 text-orange-500" /> Viewer
                  </div>
                )}

                <div className="h-4 w-px bg-neutral-800" />

                {/* Compact Volume Control */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={onToggleMute}
                    className="text-neutral-400 hover:text-white transition-colors p-1 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-none"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={onVolumeChange}
                    className="w-12 sm:w-16 accent-neutral-200 bg-neutral-800 h-1 cursor-pointer rounded-none"
                  />
                </div>
              </div>

              {/* Right Side: Sync status & Fullscreen */}
              <div className="flex items-center gap-3">
                {/* Square-themed Status Indicator */}
                <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-none">
                  <span className="h-1.5 w-1.5 bg-emerald-500 inline-block animate-pulse"></span>
                  <span className="text-[8px] sm:text-[9px] text-emerald-500 font-mono font-bold tracking-wider uppercase">
                    SYNC OK
                  </span>
                </div>

                <button
                  onClick={onToggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  className="text-neutral-400 hover:text-white transition-colors p-1 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-none"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-4 bg-neutral-950 rounded-none">
          <div className="w-10 h-10 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-3 font-mono font-bold text-xs bg-neutral-900 rounded-none">
            ST
          </div>
          <h3 className="text-[10px] sm:text-xs font-mono font-bold text-neutral-200 uppercase tracking-widest">
            No media loaded
          </h3>
          <p className="text-[9px] text-neutral-500 mt-1 max-w-xs font-mono uppercase leading-normal">
            {role === 'admin'
              ? 'Pick something from the watchlist below.'
              : 'Waiting on the host.'}
          </p>
        </div>
      )}
    </div>
  );
}

