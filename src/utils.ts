import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebaseClient';

export async function generateUniqueUsername(baseEmailOrName: string): Promise<string> {
  // Extract handle-friendly base: lowercase letters, numbers, underscores
  let clean = baseEmailOrName.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!clean || clean.length < 2) {
    clean = 'user';
  }
  
  let target = `@${clean}`;
  let attempts = 0;
  
  while (attempts < 20) {
    try {
      const q = query(collection(db, 'users'), where('username', '==', target));
      const snap = await getDocs(q);
      if (snap.empty) {
        return target;
      }
    } catch (err) {
      console.error('Error checking unique username:', err);
    }
    attempts++;
    const rand = Math.floor(100 + Math.random() * 900); // 3 digit number
    target = `@${clean}${rand}`;
  }
  
  return `@${clean}${Math.random().toString(36).substring(2, 6)}`;
}
