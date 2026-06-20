import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase project config. The web API key here is not a secret on its own —
// access is controlled by Firestore security rules, not by hiding this value.
// Swap these for your own project if you fork this.
const firebaseConfig = {
  apiKey: 'AIzaSyD2RHIxMmJPv5j9IKP68ZEVbfrhgQ8uSBg',
  authDomain: 'watch2together-7cbdc.firebaseapp.com',
  projectId: 'watch2together-7cbdc',
  storageBucket: 'watch2together-7cbdc.firebasestorage.app',
  messagingSenderId: '209468285856',
  appId: '1:209468285856:web:5a33ad395efc2cb0c33ac5',
  measurementId: 'G-GL236BNS3K',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Lets you namespace rooms per-deployment if you ever run more than one
// instance against the same Firebase project.
export const appId = globalThis.__app_id ?? 'watch-together-local';
