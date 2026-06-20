import { useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../lib/firebase';

// Signs everyone in anonymously so Firestore rules have a stable uid to key
// off of. Falls back to a local-only session if Firebase auth is unreachable,
// so the app doesn't hard-fail for friends on a flaky connection.
export function useAuth({ setUser, showToast }) {
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
        console.error('Auth error:', error);
        setUser({ uid: 'local-session' });
        showToast('Authentication unavailable. Running local session.', 'warning');
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setUser is a stable state setter
  }, [showToast]);
}
