// Firebase-backed chat: Google sign-in + one room per theme.
//
// Each room is a 100-slot ring buffer in the Realtime Database:
//   rooms/<themeId>/head          index of the newest slot (0..99)
//   rooms/<themeId>/slots/<0..99> { uid, name, photo, text, ts }
// Sending advances `head` in a transaction and overwrites that slot, so a room
// can never hold more than 100 messages. database.rules.json enforces the
// same limit on the server (slot keys 0-99 only).
//
// Firebase is imported lazily, so the game loads without it.

import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Database } from 'firebase/database';

export const ROOM_LIMIT = 100;
export const MAX_TEXT = 300;

export interface ChatMessage {
  slot: string;
  uid: string;
  name: string;
  photo?: string;
  text: string;
  ts: number;
}

export interface ChatUser {
  uid: string;
  name: string;
  photo?: string;
}

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** False until the Firebase keys are put in .env.local (see FIREBASE_SETUP.md). */
export const chatConfigured = Boolean(config.apiKey && config.databaseURL);

interface Fb {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
  authMod: typeof import('firebase/auth');
  dbMod: typeof import('firebase/database');
}

let fbPromise: Promise<Fb> | null = null;

function firebase(): Promise<Fb> {
  fbPromise ??= (async () => {
    const [appMod, authMod, dbMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/database'),
    ]);
    const app = appMod.initializeApp(config);
    return { app, auth: authMod.getAuth(app), db: dbMod.getDatabase(app), authMod, dbMod };
  })();
  return fbPromise;
}

function toUser(u: User | null): ChatUser | null {
  return u ? { uid: u.uid, name: u.displayName || 'Bear fan', photo: u.photoURL ?? undefined } : null;
}

export async function onUserChange(cb: (user: ChatUser | null) => void): Promise<() => void> {
  const { auth, authMod } = await firebase();
  return authMod.onAuthStateChanged(auth, (u) => cb(toUser(u)));
}

export async function signIn() {
  const { auth, authMod } = await firebase();
  const provider = new authMod.GoogleAuthProvider();
  try {
    await authMod.signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await authMod.signInWithRedirect(auth, provider);
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      throw e;
    }
  }
}

/** Firebase ID token of the signed-in user (proves identity to the lounge server), or null. */
export async function getIdToken(): Promise<string | null> {
  if (!chatConfigured) return null;
  const { auth } = await firebase();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export async function signOut() {
  const { auth, authMod } = await firebase();
  await authMod.signOut(auth);
}

/** Live list of a room's messages (oldest first). Returns an unsubscribe fn. */
export async function subscribe(room: string, cb: (msgs: ChatMessage[]) => void): Promise<() => void> {
  const { db, dbMod } = await firebase();
  return dbMod.onValue(dbMod.ref(db, `rooms/${room}/slots`), (snap) => {
    const val = (snap.val() ?? {}) as Record<string, Omit<ChatMessage, 'slot'>>;
    const msgs = Object.entries(val)
      .map(([slot, m]) => ({ slot, ...m }))
      .filter((m) => typeof m.text === 'string')
      .sort((a, b) => a.ts - b.ts);
    cb(msgs);
  });
}

export async function send(room: string, text: string) {
  const { auth, db, dbMod } = await firebase();
  const user = toUser(auth.currentUser);
  if (!user) throw new Error('Sign in to chat');
  const clean = text.trim().slice(0, MAX_TEXT);
  if (!clean) return;

  const head = await dbMod.runTransaction(dbMod.ref(db, `rooms/${room}/head`), (h: number | null) =>
    h === null ? 0 : (h + 1) % ROOM_LIMIT,
  );
  const slot = head.snapshot.val() as number;
  await dbMod.set(dbMod.ref(db, `rooms/${room}/slots/${slot}`), {
    uid: user.uid,
    name: user.name.slice(0, 40),
    ...(user.photo ? { photo: user.photo } : {}),
    text: clean,
    ts: dbMod.serverTimestamp(),
  });
}
