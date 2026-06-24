import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Send, Square, Play, Pause, MicOff, Pencil } from 'lucide-react';
import { useChat } from '../hooks/useChat';

const NICKNAME_KEY = 'watch-together:nickname';
const MAX_RECORD_SECONDS = 30;

// ── helpers ──────────────────────────────────────────────────────────────────

function loadNickname() {
  try {
    return localStorage.getItem(NICKNAME_KEY) || '';
  } catch {
    return '';
  }
}

function saveNickname(n) {
  try {
    localStorage.setItem(NICKNAME_KEY, n);
  } catch {}
}

function fmtTime(s) {
  const m = Math.floor((s || 0) / 60);
  const sec = Math.floor((s || 0) % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// Pick a MIME type the browser actually supports
function pickMime() {
  for (const t of [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Chat({ user, isJoined, roomId }) {
  // Display name ────────────────────────────────────────────────────────────
  const [nickname, setNickname] = useState(loadNickname);
  const [editingNick, setEditingNick] = useState(!loadNickname());
  const [draftNick, setDraftNick] = useState(loadNickname);

  // Text input ──────────────────────────────────────────────────────────────
  const [text, setText] = useState('');

  // Recording ───────────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [micDenied, setMicDenied] = useState(false);

  // Per-message playback state: { [msgId]: 'playing' | 'paused' }
  const [playState, setPlayState] = useState({});

  // Refs
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const recordSecsRef = useRef(0); // avoids stale-closure reads in onstop
  const audioMap = useRef({}); // msgId → HTMLAudioElement

  const { messages, sendText, sendVoice } = useChat({ user, isJoined, roomId });

  // Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Nickname ────────────────────────────────────────────────────────────────
  const submitNick = () => {
    const n = draftNick.trim() || 'Anonymous';
    setNickname(n);
    saveNickname(n);
    setEditingNick(false);
  };

  // Text send ───────────────────────────────────────────────────────────────
  const handleSendText = async () => {
    if (!text.trim()) return;
    await sendText(text, nickname || 'Anonymous');
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // Voice record ────────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicDenied(false);

      const mimeType = pickMime();
      const options = { audioBitsPerSecond: 32000 };
      if (mimeType) options.mimeType = mimeType;

      const recorder = new MediaRecorder(stream, options);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const effectiveMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: effectiveMime });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          await sendVoice(base64, effectiveMime, recordSecsRef.current, nickname || 'Anonymous');
        };
        reader.readAsDataURL(blob);
        setRecordSecs(0);
        recordSecsRef.current = 0;
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      recordTimerRef.current = setInterval(() => {
        const next = recordSecsRef.current + 1;
        recordSecsRef.current = next;
        setRecordSecs(next);
        if (next >= MAX_RECORD_SECONDS) stopRecording();
      }, 1000);
    } catch {
      setMicDenied(true);
    }
  };

  // Playback ────────────────────────────────────────────────────────────────
  const togglePlay = (msg) => {
    let audio = audioMap.current[msg.id];

    if (!audio) {
      const dataUrl = `data:${msg.audioType};base64,${msg.audioBase64}`;
      audio = new Audio(dataUrl);
      audioMap.current[msg.id] = audio;

      audio.onended = () => setPlayState((p) => ({ ...p, [msg.id]: 'paused' }));
      audio.onerror = () => setPlayState((p) => ({ ...p, [msg.id]: 'paused' }));
    }

    if (audio.paused) {
      // Pause every other track first
      Object.entries(audioMap.current).forEach(([id, a]) => {
        if (id !== msg.id && !a.paused) {
          a.pause();
          setPlayState((p) => ({ ...p, [id]: 'paused' }));
        }
      });
      audio.play().then(() => setPlayState((p) => ({ ...p, [msg.id]: 'playing' }))).catch(() => {});
    } else {
      audio.pause();
      setPlayState((p) => ({ ...p, [msg.id]: 'paused' }));
    }
  };

  const isMe = (msg) => msg.uid === user?.uid;

  if (!isJoined) return null;

  return (
    <div className="flex flex-col border border-neutral-800 bg-neutral-950" style={{ height: '420px' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-neutral-800 px-3 py-2 flex items-center justify-between">
        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
          Chat · {roomId}
        </span>
        <button
          onClick={() => { setDraftNick(nickname); setEditingNick(true); }}
          className="flex items-center gap-1 text-[9px] text-orange-500 hover:text-orange-400 uppercase tracking-wider font-bold transition-colors"
          title="Change display name"
        >
          <Pencil className="w-2.5 h-2.5" />
          {nickname || 'Set name'}
        </button>
      </div>

      {/* ── Nickname editor ─────────────────────────────────────────────── */}
      {editingNick && (
        <div className="flex-shrink-0 border-b border-neutral-800 bg-neutral-900 px-3 py-2 flex gap-2 items-center">
          <input
            autoFocus
            value={draftNick}
            onChange={(e) => setDraftNick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNick()}
            placeholder="Display name (no login needed)"
            maxLength={24}
            className="flex-1 bg-neutral-950 border border-neutral-700 focus:border-orange-500 px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none transition-colors"
          />
          <button
            onClick={submitNick}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-black font-bold text-[10px] uppercase tracking-wider transition-colors"
          >
            Save
          </button>
        </div>
      )}

      {/* ── Message list ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-[10px] text-neutral-700 uppercase tracking-wider pt-6 select-none">
            No messages yet — say hello
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe(msg) ? 'items-end' : 'items-start'}`}>
            <span className="text-[9px] text-neutral-600 uppercase tracking-wider px-0.5">
              {msg.nickname}
            </span>

            {msg.type === 'text' ? (
              <div
                className={`max-w-[88%] px-2.5 py-1.5 text-[11px] leading-relaxed break-words ${
                  isMe(msg)
                    ? 'bg-orange-600 text-black font-medium'
                    : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                }`}
              >
                {msg.text}
              </div>
            ) : (
              // Voice message pill
              <button
                onClick={() => togglePlay(msg)}
                className={`flex items-center gap-2 px-2.5 py-1.5 text-[11px] border transition-colors ${
                  isMe(msg)
                    ? 'border-orange-700 bg-orange-950 text-orange-300 hover:bg-orange-900'
                    : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {playState[msg.id] === 'playing' ? (
                  <Pause className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <Play className="w-3 h-3 flex-shrink-0" />
                )}
                <span className="font-mono text-[10px]">
                  Voice · {fmtTime(msg.durationSec)}
                </span>
              </button>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-neutral-800 p-2.5 space-y-2">

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 px-2 py-1 bg-red-950 border border-red-800">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-[10px] text-red-400 font-mono uppercase tracking-wider">
              REC {fmtTime(recordSecs)} / {fmtTime(MAX_RECORD_SECONDS)}
            </span>
            <span className="text-[10px] text-red-600 ml-auto">tap ■ to send</span>
          </div>
        )}

        <div className="flex gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Recording…' : 'Type a message…'}
            disabled={isRecording}
            className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 focus:border-neutral-600 px-2.5 py-2 text-xs text-white placeholder-neutral-700 focus:outline-none transition-colors disabled:opacity-40"
          />

          {/* Send text */}
          <button
            onClick={handleSendText}
            disabled={!text.trim() || isRecording}
            title="Send (Enter)"
            className="flex-shrink-0 px-2.5 py-2 bg-neutral-100 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-black transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>

          {/* Mic / Stop */}
          {micDenied ? (
            <button
              disabled
              title="Microphone access denied"
              className="flex-shrink-0 px-2.5 py-2 border border-neutral-800 text-neutral-700 cursor-not-allowed"
            >
              <MicOff className="w-3.5 h-3.5" />
            </button>
          ) : isRecording ? (
            <button
              onClick={stopRecording}
              title="Stop & send voice"
              className="flex-shrink-0 px-2.5 py-2 bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={!!text.trim()}
              title="Record voice message (max 30 s)"
              className="flex-shrink-0 px-2.5 py-2 border border-neutral-700 hover:border-orange-500 hover:text-orange-400 text-neutral-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
