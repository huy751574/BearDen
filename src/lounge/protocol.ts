// Messages between the lounge client (browser) and the lounge server
// (Cloudflare Durable Object, server/src/Lounge.ts). JSON over one WebSocket.
// Shared by both sides, so keep it dependency-free.

export const MAX_SLOTS = 50;
export const IDLE_SECONDS = 60;
export const ISLAND_RADIUS = 16;
export const WALK_RADIUS = ISLAND_RADIUS - 1.4;
export const MAX_QUEUE = 30;
export const MAX_SONG_SECONDS = 600;
export const CHAT_LIMIT = 100;
export const MAX_CHAT_CHARS = 300;

export interface Player {
  slot: number;
  uid: string;
  name: string;
  x: number;
  z: number;
  /** Walk target, or null when standing. */
  tx: number | null;
  tz: number | null;
}

export interface Song {
  videoId: string;
  title: string;
  by: string; // display name of who queued it ("Bear Den Radio" for house songs)
  byUid: string | null;
  /** Server time (ms) when playback position 0 is/was. */
  startedAt: number;
  /** Seconds, once known (house songs know it; others are reported by clients). */
  duration: number | null;
}

export interface QueueItem {
  videoId: string;
  title: string;
  by: string;
  byUid: string;
}

export interface ChatMsg {
  id: number;
  uid: string;
  name: string;
  text: string;
  ts: number;
}

export type Act = 'jump' | 'pillow' | 'wave' | 'sit';

// ---------------------------------------------------------------- client -> server

export type ClientMsg =
  | { t: 'hello'; token: string | null; guestName?: string }
  | { t: 'join' }
  | { t: 'leave' }
  | { t: 'move'; x: number; z: number; tx: number | null; tz: number | null }
  | { t: 'act'; a: Act }
  | { t: 'chat'; text: string }
  | { t: 'queue'; url: string }
  | { t: 'vote' }
  | { t: 'duration'; videoId: string; seconds: number }
  | { t: 'playerError'; videoId: string; code: number }
  | { t: 'ping' };

// ---------------------------------------------------------------- server -> client

export interface You {
  signedIn: boolean;
  name: string | null;
  uid: string | null;
  slot: number | null;
  /** 1-based place in the waitlist, or null. */
  waiting: number | null;
}

export interface Counts {
  viewers: number;
  players: number;
  waiting: number;
}

export interface Votes {
  count: number;
  need: number;
  /** Only meaningful in 'welcome'; broadcasts send false (clients track their own vote). */
  mine: boolean;
}

export type ServerMsg =
  | { t: 'welcome'; now: number; you: You; players: Player[]; song: Song | null; queue: QueueItem[]; votes: Votes; counts: Counts; chat: ChatMsg[] }
  | { t: 'you'; you: You }
  | { t: 'joined'; player: Player }
  | { t: 'left'; slot: number; reason: 'jumpoff' | 'idle' | 'left' | 'disconnect' }
  | { t: 'move'; slot: number; x: number; z: number; tx: number | null; tz: number | null }
  | { t: 'act'; slot: number; a: Act; hits?: { slot: number; dx: number; dz: number }[] }
  | { t: 'song'; song: Song | null; queue: QueueItem[]; votes: Votes }
  | { t: 'queue'; queue: QueueItem[] }
  | { t: 'votes'; votes: Votes }
  | { t: 'counts'; counts: Counts }
  | { t: 'chat'; msg: ChatMsg }
  | { t: 'idleWarning'; seconds: number }
  | { t: 'notice'; text: string; kind: 'info' | 'error' }
  | { t: 'pong'; now: number };

/** Pull an 11-character video id out of any common YouTube link (or a bare id). */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      if (!id && m) id = m[1];
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Skip needs 20% of everyone in the room, or 50% of active players, whichever is smaller. */
export function votesNeeded(viewers: number, players: number): number {
  const byViewers = Math.max(1, Math.ceil(viewers * 0.2));
  const byPlayers = players > 0 ? Math.max(1, Math.ceil(players * 0.5)) : Infinity;
  return Math.min(byViewers, byPlayers);
}
