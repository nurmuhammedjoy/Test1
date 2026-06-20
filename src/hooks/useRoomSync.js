import { useEffect } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { appId, db } from '../lib/firebase';

// One Firestore doc per room, holding whatever's currently playing and the
// host passcode. Path follows the standard "public app data" shape so it
// works whether or not Firestore rules are scoped per-app.
function roomRef(roomId) {
  return doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
}

export function useRoomSync({
  user,
  isJoined,
  roomId,
  role,
  isAdminUnlocked,
  adminPasscode,
  onRemoteData,
  showToast,
}) {
  useEffect(() => {
    if (!user || !isJoined) return;

    const unsubscribe = onSnapshot(
      roomRef(roomId),
      (docSnap) => {
        if (docSnap.exists()) {
          onRemoteData(docSnap.data());
          return;
        }

        // Room doesn't exist yet — only a host who's unlocked admin mode
        // gets to create it, so a guest landing on a typo'd room code
        // can't accidentally spin up an empty room.
        if (role === 'admin' && isAdminUnlocked) {
          setDoc(roomRef(roomId), {
            playing: false,
            currentTime: 0,
            videoUrl: '',
            lastUpdatedBy: user.uid,
            updatedAt: serverTimestamp(),
            adminPasscode: adminPasscode || '1234',
          });
        }
      },
      (error) => {
        console.error('Firestore error:', error);
        showToast('Connection dropped. Re-establishing link...', 'error');
      }
    );

    return () => unsubscribe();
  }, [user, isJoined, roomId, role, isAdminUnlocked, adminPasscode, onRemoteData, showToast]);

  // Host-only write path. Merges so a seek update doesn't clobber fields
  // it isn't touching (like the passcode).
  const pushRoomState = async (payload) => {
    if (!user || role !== 'admin' || !isAdminUnlocked) return;

    try {
      await setDoc(
        roomRef(roomId),
        { ...payload, lastUpdatedBy: user.uid, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error('Error writing sync state:', err);
    }
  };

  return { pushRoomState };
}
