import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index';
import { verifyFirebaseToken } from './auth';
import house from './house.json';
import {
  MAX_SLOTS, IDLE_SECONDS, WALK_RADIUS, MAX_QUEUE, MAX_SONG_SECONDS, CHAT_LIMIT, MAX_CHAT_CHARS,
  parseYouTubeId, votesNeeded,
  type ClientMsg, type ServerMsg, type Player, type Song, type QueueItem, type ChatMsg, type You, type Counts, type Votes,
} from '../../src/lounge/protocol';

// The Bear Den Lounge room: one instance holds everything.
//  - 50 avatar slots; everyone else can watch and join a waitlist.
//  - A shared YouTube queue played in sync (startedAt server time); when the
//    queue is empty, Bear Den house songs play.
//  - Skip when votes >= 20% of viewers or 50% of players (whichever is fewer).
//  - A player with no action or chat for 60 s jumps off the island and the
//    next person in the waitlist gets the slot.
// Uses the WebSocket Hibernation API: per-socket data lives in attachments
// and room state in storage, so the object can sleep when the room is quiet.

interface Attachment {
  id: string;
  uid: string | null;
  name: string | null;
  signedIn: boolean;
  slot: number | null;
  x: number;
  z: number;
  tx: number | null;
  tz: number | null;
  lastActive: number;
  warned: boolean;
  waitingSince: number | null;
  lastMove: number;
  lastAct: number;
  lastPillow: number;
  lastChat: number;
}

interface RoomState {
  song: Song | null;
  queue: QueueItem[];
  chat: ChatMsg[];
  votes: string[];
  errors: string[];
  chatId: number;
}

const HOUSE = house as { videoId: string; title: string; duration: number }[];
const START_DELAY = 2500; // ms of buffer so every client can load the video
const IDLE_WARN = 45;

export class Lounge extends DurableObject<Env> {
  private room: RoomState = { song: null, queue: [], chat: [], votes: [], errors: [], chatId: 0 };
  private countsTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<RoomState>('room');
      if (saved) this.room = { ...this.room, ...saved };
    });
  }

  // ---------------------------------------------------------------- connections

  async fetch(): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const att: Attachment = {
      id: crypto.randomUUID(), uid: null, name: null, signedIn: false, slot: null, x: 0, z: 0, tx: null, tz: null,
      lastActive: Date.now(), warned: false, waitingSince: null, lastMove: 0, lastAct: 0, lastPillow: 0, lastChat: 0,
    };
    server.serializeAttachment(att);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > 4000) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const att = this.att(ws);
    const now = Date.now();
    switch (msg.t) {
      case 'hello': return this.hello(ws, att, msg.token, msg.guestName);
      case 'ping': return this.send(ws, { t: 'pong', now });
      case 'join': return this.join(ws, att);
      case 'leave': return this.leave(ws, att, 'left');
      case 'move': return this.move(ws, att, msg, now);
      case 'act': return this.act(ws, att, msg.a, now);
      case 'chat': return this.chat(ws, att, msg.text, now);
      case 'queue': return this.enqueue(ws, att, msg.url);
      case 'vote': return this.vote(ws, att);
      case 'duration': return this.duration(msg.videoId, msg.seconds);
      case 'playerError': return this.playerError(att, msg.videoId);
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.dropSocket(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.dropSocket(ws);
  }

  private dropSocket(ws: WebSocket) {
    const att = this.att(ws);
    if (att.slot !== null) this.freeSlot(ws, att, 'disconnect');
    att.waitingSince = null;
    this.save(ws, att);
    this.broadcastCounts();
  }

  // ---------------------------------------------------------------- handlers

  private async hello(ws: WebSocket, att: Attachment, token: string | null, guestName?: string) {
    const id = token ? await verifyFirebaseToken(token, this.env.FIREBASE_PROJECT_ID) : null;
    if (id) {
      Object.assign(att, { uid: id.uid, name: id.name, signedIn: true });
    } else if (this.env.ALLOW_GUESTS === 'true') {
      const name = (guestName ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 20) || `Guest ${att.id.slice(0, 4)}`;
      Object.assign(att, { uid: `guest-${att.id}`, name, signedIn: false });
    }
    this.save(ws, att);
    if (!this.room.song || this.songOver()) this.advance();
    this.send(ws, {
      t: 'welcome', now: Date.now(), you: this.you(att), players: this.players(), song: this.room.song,
      queue: this.room.queue, votes: this.votes(att), counts: this.counts(), chat: this.room.chat,
    });
    this.broadcastCounts();
    this.schedule();
  }

  private join(ws: WebSocket, att: Attachment) {
    if (!att.uid) return this.notice(ws, 'Sign in with Google to take an avatar.', 'error');
    if (att.slot !== null) return;
    if (this.sockets().some((w) => w !== ws && this.att(w).uid === att.uid && this.att(w).slot !== null)) {
      return this.notice(ws, "You're already on the island in another tab.", 'error');
    }
    const slot = this.freeSlotIndex();
    if (slot === null) {
      att.waitingSince ??= Date.now();
      this.save(ws, att);
      this.send(ws, { t: 'you', you: this.you(att) });
      this.broadcastCounts();
      return;
    }
    this.seat(ws, att, slot);
  }

  private leave(ws: WebSocket, att: Attachment, reason: 'left') {
    if (att.slot !== null) this.freeSlot(ws, att, reason);
    att.waitingSince = null;
    this.save(ws, att);
    this.send(ws, { t: 'you', you: this.you(att) });
    this.broadcastCounts();
  }

  private move(ws: WebSocket, att: Attachment, m: { x: number; z: number; tx: number | null; tz: number | null }, now: number) {
    if (att.slot === null || now - att.lastMove < 50) return;
    const p = clampToIsland(num(m.x), num(m.z));
    const t = m.tx === null || m.tz === null ? null : clampToIsland(num(m.tx), num(m.tz));
    Object.assign(att, { x: p.x, z: p.z, tx: t?.x ?? null, tz: t?.z ?? null, lastMove: now });
    this.touch(att, now);
    this.save(ws, att);
    this.broadcast({ t: 'move', slot: att.slot, x: att.x, z: att.z, tx: att.tx, tz: att.tz }, ws);
  }

  private act(ws: WebSocket, att: Attachment, a: string, now: number) {
    if (att.slot === null || now - att.lastAct < 250) return;
    if (a !== 'jump' && a !== 'pillow' && a !== 'wave' && a !== 'sit') return;
    att.lastAct = now;
    this.touch(att, now);
    let hits: { slot: number; dx: number; dz: number }[] | undefined;
    if (a === 'pillow') {
      if (now - att.lastPillow < 900) return this.save(ws, att);
      att.lastPillow = now;
      hits = [];
      for (const w of this.sockets()) {
        const o = this.att(w);
        if (w === ws || o.slot === null) continue;
        const dx = o.x - att.x, dz = o.z - att.z, d = Math.hypot(dx, dz);
        if (d > 1.9) continue;
        // Knock them back 1.8 m, away from the hitter (never off the island).
        const k = 1.8 / (d || 1);
        const p = clampToIsland(o.x + (d ? dx : 1) * k, o.z + (d ? dz : 0) * k);
        hits.push({ slot: o.slot, dx: p.x - o.x, dz: p.z - o.z });
        Object.assign(o, { x: p.x, z: p.z, tx: null, tz: null });
        this.save(w, o);
      }
    }
    this.save(ws, att);
    this.broadcast({ t: 'act', slot: att.slot, a, ...(hits ? { hits } : {}) });
  }

  private chat(ws: WebSocket, att: Attachment, text: string, now: number) {
    if (!att.uid) return this.notice(ws, 'Sign in to chat.', 'error');
    if (now - att.lastChat < 1200) return;
    const clean = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_CHARS);
    if (!clean) return;
    att.lastChat = now;
    this.touch(att, now);
    this.save(ws, att);
    const msg: ChatMsg = { id: ++this.room.chatId, uid: att.uid, name: att.name ?? 'Bear fan', text: clean, ts: now };
    this.room.chat.push(msg);
    if (this.room.chat.length > CHAT_LIMIT) this.room.chat.splice(0, this.room.chat.length - CHAT_LIMIT);
    this.persist();
    this.broadcast({ t: 'chat', msg });
  }

  private async enqueue(ws: WebSocket, att: Attachment, url: string) {
    if (!att.uid) return this.notice(ws, 'Sign in to add songs.', 'error');
    const videoId = parseYouTubeId(String(url ?? ''));
    if (!videoId) return this.notice(ws, "That doesn't look like a YouTube link.", 'error');
    if (this.room.queue.some((q) => q.byUid === att.uid)) return this.notice(ws, 'You already have a song in the queue. Wait for it to play!', 'error');
    if (this.room.queue.length >= MAX_QUEUE) return this.notice(ws, `The queue is full (${MAX_QUEUE} songs). Try again later.`, 'error');
    if (this.room.song?.videoId === videoId || this.room.queue.some((q) => q.videoId === videoId)) {
      return this.notice(ws, 'That song is already playing or queued.', 'error');
    }
    const meta = await fetchTitle(videoId);
    if ('error' in meta) return this.notice(ws, meta.error, 'error');
    this.touch(att, Date.now());
    this.save(ws, att);
    this.room.queue.push({ videoId, title: meta.title.slice(0, 120), by: att.name ?? 'Bear fan', byUid: att.uid });
    this.notice(ws, `Added "${meta.title.slice(0, 60)}" to the queue.`, 'info');
    // A house song gives way as soon as someone requests a song.
    if (!this.room.song || this.room.song.byUid === null) this.advance();
    else {
      this.persist();
      this.broadcast({ t: 'queue', queue: this.room.queue });
    }
  }

  private vote(ws: WebSocket, att: Attachment) {
    if (!att.uid) return this.notice(ws, 'Sign in to vote.', 'error');
    if (!this.room.song || this.room.votes.includes(att.uid)) return;
    this.room.votes.push(att.uid);
    this.touch(att, Date.now());
    this.save(ws, att);
    if (this.room.votes.length >= this.need()) {
      this.broadcastNotice(`Skipped "${this.room.song.title.slice(0, 50)}" by vote.`);
      return this.advance();
    }
    this.persist();
    this.broadcastVotes();
  }

  private duration(videoId: string, seconds: number) {
    const song = this.room.song;
    if (!song || song.videoId !== videoId || song.duration !== null || !(seconds > 1)) return;
    if (seconds > MAX_SONG_SECONDS + 5) {
      this.broadcastNotice(`"${song.title.slice(0, 50)}" is longer than ${MAX_SONG_SECONDS / 60} minutes. Skipping.`);
      return this.advance();
    }
    song.duration = Math.round(seconds);
    this.persist();
    this.broadcast({ t: 'song', song, queue: this.room.queue, votes: this.votesFor(null) });
    this.schedule();
  }

  private playerError(att: Attachment, videoId: string) {
    const song = this.room.song;
    if (!song || song.videoId !== videoId) return;
    const who = att.uid ?? att.id;
    if (!this.room.errors.includes(who)) this.room.errors.push(who);
    // Two reports (or everyone, if the room is tiny) means the video can't play here.
    if (this.room.errors.length >= Math.min(2, this.sockets().length)) {
      this.broadcastNotice(`"${song.title.slice(0, 50)}" can't be played here (embedding disabled). Skipping.`);
      this.advance();
    }
  }

  // ---------------------------------------------------------------- song flow

  private advance() {
    const next = this.room.queue.shift();
    const now = Date.now();
    if (next) {
      this.room.song = { ...next, startedAt: now + START_DELAY, duration: null };
    } else {
      const pick = HOUSE.filter((h) => h.videoId !== this.room.song?.videoId);
      const h = pick[Math.floor(Math.random() * pick.length)] ?? HOUSE[0];
      this.room.song = h ? { videoId: h.videoId, title: h.title, by: 'Bear Den Radio', byUid: null, startedAt: now + START_DELAY, duration: h.duration } : null;
    }
    this.room.votes = [];
    this.room.errors = [];
    this.persist();
    this.broadcast({ t: 'song', song: this.room.song, queue: this.room.queue, votes: this.votesFor(null) });
    this.schedule();
  }

  private songOver(now = Date.now()) {
    const s = this.room.song;
    if (!s) return true;
    if (s.duration !== null) return now > s.startedAt + s.duration * 1000 + 1500;
    return now > s.startedAt + (MAX_SONG_SECONDS + 60) * 1000; // nobody reported a length
  }

  // ---------------------------------------------------------------- idle + alarms

  async alarm() {
    const now = Date.now();
    const sockets = this.sockets();
    if (!sockets.length) return; // empty room: let the object sleep
    if (this.songOver(now)) this.advance();
    for (const ws of sockets) {
      const att = this.att(ws);
      if (att.slot === null) continue;
      const idle = (now - att.lastActive) / 1000;
      if (idle >= IDLE_SECONDS) {
        this.freeSlot(ws, att, 'idle');
        this.save(ws, att);
        this.notice(ws, 'You were idle for 60 seconds, so your avatar jumped off the island. Join again any time!', 'info');
        this.send(ws, { t: 'you', you: this.you(att) });
      } else if (idle >= IDLE_WARN && !att.warned) {
        att.warned = true;
        this.save(ws, att);
        this.send(ws, { t: 'idleWarning', seconds: Math.ceil(IDLE_SECONDS - idle) });
      }
    }
    this.broadcastCounts();
    this.schedule();
  }

  /** Wake up for the next song change or idle deadline. */
  private schedule() {
    const now = Date.now();
    const times: number[] = [];
    const s = this.room.song;
    if (s) times.push(s.duration !== null ? s.startedAt + s.duration * 1000 + 1600 : s.startedAt + (MAX_SONG_SECONDS + 61) * 1000);
    for (const ws of this.sockets()) {
      const a = this.att(ws);
      if (a.slot === null) continue;
      times.push(a.lastActive + (a.warned ? IDLE_SECONDS : IDLE_WARN) * 1000 + 50);
    }
    if (!times.length) return;
    void this.ctx.storage.setAlarm(Math.max(now + 200, Math.min(...times)));
  }

  private touch(att: Attachment, now: number) {
    att.lastActive = now;
    att.warned = false;
  }

  // ---------------------------------------------------------------- slots

  private seat(ws: WebSocket, att: Attachment, slot: number) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4;
    Object.assign(att, { slot, x: Math.cos(a) * r, z: Math.sin(a) * r, tx: null, tz: null, waitingSince: null });
    this.touch(att, Date.now());
    this.save(ws, att);
    this.send(ws, { t: 'you', you: this.you(att) });
    this.broadcast({ t: 'joined', player: toPlayer(att) });
    this.broadcastCounts();
    this.schedule();
  }

  private freeSlot(ws: WebSocket, att: Attachment, reason: 'jumpoff' | 'idle' | 'left' | 'disconnect') {
    const slot = att.slot;
    if (slot === null) return;
    att.slot = null;
    this.save(ws, att);
    this.broadcast({ t: 'left', slot, reason });
    // Next in the waitlist takes the free slot.
    const next = this.sockets()
      .map((w) => [w, this.att(w)] as const)
      .filter(([, a]) => a.waitingSince !== null && a.slot === null)
      .sort((x, y) => x[1].waitingSince! - y[1].waitingSince!)[0];
    if (next) {
      this.seat(next[0], next[1], slot);
      this.notice(next[0], "It's your turn: you're on the island!", 'info');
      this.sendWaitlistPositions();
    }
  }

  private freeSlotIndex(): number | null {
    const used = new Set(this.sockets().map((w) => this.att(w).slot).filter((s) => s !== null));
    for (let i = 0; i < MAX_SLOTS; i++) if (!used.has(i)) return i;
    return null;
  }

  private sendWaitlistPositions() {
    for (const ws of this.sockets()) {
      const a = this.att(ws);
      if (a.waitingSince !== null) this.send(ws, { t: 'you', you: this.you(a) });
    }
  }

  // ---------------------------------------------------------------- views

  private you(att: Attachment): You {
    let waiting: number | null = null;
    if (att.waitingSince !== null && att.slot === null) {
      waiting = 1 + this.sockets().filter((w) => {
        const o = this.att(w);
        return o.waitingSince !== null && o.slot === null && o.waitingSince < att.waitingSince!;
      }).length;
    }
    return { signedIn: att.signedIn, name: att.name, uid: att.uid, slot: att.slot, waiting };
  }

  private players(): Player[] {
    return this.sockets().map((w) => this.att(w)).filter((a) => a.slot !== null).map(toPlayer);
  }

  private counts(): Counts {
    const atts = this.sockets().map((w) => this.att(w));
    return {
      viewers: atts.length,
      players: atts.filter((a) => a.slot !== null).length,
      waiting: atts.filter((a) => a.waitingSince !== null && a.slot === null).length,
    };
  }

  private need() {
    const c = this.counts();
    return votesNeeded(c.viewers, c.players);
  }

  private votes(att: Attachment): Votes {
    return this.votesFor(att.uid);
  }

  private votesFor(uid: string | null): Votes {
    return { count: this.room.votes.length, need: this.need(), mine: !!uid && this.room.votes.includes(uid) };
  }

  // ---------------------------------------------------------------- plumbing

  private sockets() {
    return this.ctx.getWebSockets();
  }

  private att(ws: WebSocket): Attachment {
    return ws.deserializeAttachment() as Attachment;
  }

  private save(ws: WebSocket, att: Attachment) {
    ws.serializeAttachment(att);
  }

  private persist() {
    void this.ctx.storage.put('room', this.room);
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket already closed */
    }
  }

  private broadcast(msg: ServerMsg, except?: WebSocket) {
    const data = JSON.stringify(msg);
    for (const ws of this.sockets()) {
      if (ws === except) continue;
      try {
        ws.send(data);
      } catch {
        /* closed */
      }
    }
  }

  /**
   * Room counts (and the vote threshold that depends on them) change on every
   * join/leave; batch them into one broadcast every 150 ms so a crowd arriving
   * at once doesn't cause N x N messages.
   */
  private broadcastCounts() {
    this.countsTimer ??= setTimeout(() => {
      this.countsTimer = null;
      this.broadcast({ t: 'counts', counts: this.counts() });
      this.broadcastVotes();
    }, 150);
  }

  /** One shared message; each client knows whether it voted itself. */
  private broadcastVotes() {
    this.broadcast({ t: 'votes', votes: this.votesFor(null) });
  }

  private notice(ws: WebSocket, text: string, kind: 'info' | 'error') {
    this.send(ws, { t: 'notice', text, kind });
  }

  private broadcastNotice(text: string) {
    this.broadcast({ t: 'notice', text, kind: 'info' });
  }
}

function toPlayer(a: Attachment): Player {
  return { slot: a.slot!, uid: a.uid ?? '', name: a.name ?? 'Bear fan', x: a.x, z: a.z, tx: a.tx, tz: a.tz };
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampToIsland(x: number, z: number) {
  const d = Math.hypot(x, z);
  return d > WALK_RADIUS ? { x: (x / d) * WALK_RADIUS, z: (z / d) * WALK_RADIUS } : { x, z };
}

/** Title via YouTube oEmbed; this also tells us if the video exists and allows embedding. */
async function fetchTitle(videoId: string): Promise<{ title: string } | { error: string }> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`);
    if (r.status === 401 || r.status === 403) return { error: "That video doesn't allow playing on other sites." };
    if (!r.ok) return { error: "Couldn't find that video (private or deleted?)." };
    const j = (await r.json()) as { title?: string };
    return { title: j.title || 'Untitled' };
  } catch {
    return { error: "Couldn't reach YouTube. Try again in a moment." };
  }
}
