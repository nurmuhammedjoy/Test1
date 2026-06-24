import { useEffect, useCallback, useState } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { appId, db } from '../lib/firebase';

// Messages live as a subcollection under the room doc so they don't bloat
// the room snapshot that the video sync logic reads.
function messagesRef(roomId) {
  return collection(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'messages');
}

export function useChat({ user, isJoined, roomId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!user || !isJoined) return;

    const q = query(messagesRef(roomId), orderBy('timestamp', 'asc'), limit(120));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error('Chat snapshot error:', err);
      }
    );

    return () => unsubscribe();
  }, [user, isJoined, roomId]);

  const sendText = useCallback(
    async (text, nickname) => {
      if (!user || !text.trim()) return;
      try {
        await addDoc(messagesRef(roomId), {
          type: 'text',
          text: text.trim(),
          nickname: nickname || 'Anonymous',
          uid: user.uid,
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.error('Send text error:', err);
      }
    },
    [user, roomId]
  );

  // Voice messages are stored as base64 blobs directly in Firestore.
  // A 30-second clip at 32 kbps is ~120 KB raw, ~160 KB base64 — well
  // inside Firestore's 1 MB document cap.
  const sendVoice = useCallback(
    async (audioBase64, audioType, durationSec, nickname) => {
      if (!user || !audioBase64) return;
      try {
        await addDoc(messagesRef(roomId), {
          type: 'voice',
          audioBase64,
          audioType,
          durationSec,
          nickname: nickname || 'Anonymous',
          uid: user.uid,
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.error('Send voice error:', err);
      }
    },
    [user, roomId]
  );

  return { messages, sendText, sendVoice };
}
