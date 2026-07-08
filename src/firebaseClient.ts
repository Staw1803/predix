import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
  firebaseConfig.projectId !== 'YOUR_FIREBASE_PROJECT_ID'
);

if (!isFirebaseConfigured) {
  console.warn(
    'Firebase is not configured yet. Please configure your .env file with VITE_FIREBASE_API_KEY and other parameters. Falling back to local simulated state.'
  );
}

// Fallback initialization to prevent client SDK crashes on builder
const app = getApps().length === 0 
  ? initializeApp(
      isFirebaseConfigured 
        ? firebaseConfig 
        : {
            apiKey: 'dummy-api-key',
            authDomain: 'dummy-auth-domain',
            projectId: 'dummy-project-id-placeholder',
            appId: 'dummy-app-id',
          }
    )
  : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };
