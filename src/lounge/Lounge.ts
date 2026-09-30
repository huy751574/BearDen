import * as THREE from 'three';
import type { Game } from '../engine/Game';
import { LoungeWorld } from './LoungeWorld';
import { LoungeClient, LOUNGE_URL } from './LoungeClient';
import { SyncedPlayer } from './SyncedPlayer';
import { Avatar, avatarLabel } from './avatars';
import { chatConfigured, getIdToken, onUserChange, signIn } from '../chat/ChatService';
import {
  MAX_CHAT_CHARS, MAX_QUEUE, MAX_SLOTS,
  type ServerMsg, type Song, type QueueItem, type Votes, type Counts, type You, type ChatMsg, type Player,
} from './protocol';

// The Bear Den Lounge screen: connects to the room server, shows everyone on
// the lounge island, keeps the YouTube player in sync, and handles the song
// queue, vote-skip, lounge chat, joining (50 avatars) and the waitlist.

export class Lounge {
  readonly el = document.createElement('div');
  private world = new LoungeWorld();
  private client: LoungeClient | null = null;
  private player: SyncedPlayer;
  private you: You = { signedIn: false, name: null, uid: null, slot: null, waiting: null };
  private song: Song | null = null;
  private votes: Votes = { count: 0, need: 1, mine: false };
  private myVoteFor = '';
  private mine: Avatar | null = null;
  private jumpT = 0;
  /** Pillow hits that pushed someone off the edge, until their "left" arrives. */
  private knockedOff = new Map<number, { dx: number; dz: number }>();
  private lastSent = { x: NaN, z: NaN, tx: NaN as number | null, tz: NaN as number | null, at: 0, moving: false };
  private idleTimer = 0;
  private unsubUser: (() => void) | null = null;
  private $: Record<string, HTMLElement> = {};
  private frameHook = (dt: number) => this.frame(dt);

  constructor(private game: Game, private onExit: () => void) {
    this.el.className = 'lounge';
    this.el.innerHTML = `
      <div class="lg-top">
        <button class="back lg-exit">← Leave lounge</button>
        <div class="lg-title">🛋️ Bear Den Lounge</div>
        <div class="lg-counts"></div>
      </div>
      <div class="lg-status"></div>
      <div class="lg-idle" hidden></div>
      <div class="lg-left">
        <div class="lg-join"></div>
        <div class="lg-chat">
          <div class="lg-log" aria-live="polite"></div>
          <form class="lg-form"><input maxlength="${MAX_CHAT_CHARS}" placeholder="Say hi to the lounge…" aria-label="Chat message" autocomplete="off"><button>Send</button></form>
        </div>
      </div>
      <div class="lg-radio">
        <div class="label">Now playing</div>
        <div class="lg-song"></div>
        <div class="lg-by"></div>
        <div class="screen lg-screen"></div>
        <div class="lg-controls">
          <button class="lg-skip">⏭ Skip</button>
          <span class="lg-votes"></span>
        </div>
        <form class="lg-add"><input placeholder="Paste a YouTube link…" aria-label="YouTube link" autocomplete="off"><button>Add</button></form>
        <div class="lg-qhead"></div>
        <ol class="lg-queue"></ol>
      </div>
      <div class="lg-hint"><kbd>WASD</kbd>/click move · <kbd>Space</kbd> jump · <kbd>F</kbd> pillow · <kbd>Q</kbd> wave · <kbd>E</kbd> sit · <kbd>Enter</kbd> chat</div>
      <div class="lg-toast" hidden></div>`;
    for (const k of ['exit', 'counts', 'status', 'idle', 'join', 'log', 'song', 'by', 'screen', 'skip', 'votes', 'qhead', 'queue', 'toast']) {
      this.$[k] = this.el.querySelector(`.lg-${k}`)!;
    }
    this.$.exit.onclick = () => this.onExit();
    this.$.skip.onclick = () => this.client?.send({ t: 'vote' });
    const chatForm = this.el.querySelector<HTMLFormElement>('.lg-form')!;
    chatForm.onsubmit = (e) => {
      e.preventDefault();
      const input = chatForm.querySelector('input')!;
      if (input.value.trim()) this.client?.send({ t: 'chat', text: input.value });
      input.value = '';
    };
    const addForm = this.el.querySelector<HTMLFormElement>('.lg-add')!;
    addForm.onsubmit = (e) => {
      e.preventDefault();
      const input = addForm.querySelector('input')!;
      if (input.value.trim()) this.client?.send({ t: 'queue', url: input.value });
      input.value = '';
    };
    this.player = new SyncedPlayer(this.$.screen, () => this.client?.now() ?? Date.now(), {
      duration: (videoId, seconds) => this.client?.send({ t: 'duration', videoId, seconds }),
      error: (videoId, code) => this.client?.send({ t: 'playerError', videoId, code }),
    });
  }

  // ---------------------------------------------------------------- lifecycle

  enter() {
    this.game.setWorld(this.world);
    this.game.setMode('play');
    this.game.controlsEnabled = false;
    this.game.frameHooks.push(this.frameHook);
    this.overview();
    this.renderJoin();
    this.renderSong();
    if (!LOUNGE_URL) {
      this.status('The lounge server isn\'t set up yet (see LOUNGE_SETUP.md).');
      return;
    }
    const guest = `Guest Bear ${Math.floor(Math.random() * 900 + 100)}`;
    this.client = new LoungeClient(LOUNGE_URL, getIdToken, guest);
    this.client.onMessage = (m) => this.onMessage(m);
    this.client.onStatus = (s) => this.status(s === 'open' ? '' : s === 'connecting' ? 'Connecting to the lounge…' : 'Disconnected, reconnecting…');
    this.client.connect();
    if (chatConfigured) {
      onUserChange(() => this.client?.hello()).then((u) => (this.unsubUser = u)).catch(() => {});
    }
  }

  leave() {
    this.client?.close();
    this.client = null;
    this.player.destroy();
    this.unsubUser?.();
    this.game.frameHooks.splice(this.game.frameHooks.indexOf(this.frameHook), 1);
    this.game.controlsEnabled = true;
    this.game.resetCharacter(); // the avatar (or its jumped-off leftover) goes; the hero bear returns
    clearInterval(this.idleTimer);
  }

  /** Keys while in the lounge. Returns true if handled (Game won't act on it). */
  onKey(key: string) {
    if (key === 'enter') {
      this.el.querySelector<HTMLInputElement>('.lg-form input')?.focus();
      return true;
    }
    if (this.you.slot === null || !this.mine) return false;
    if (key === ' ') {
      if (this.jumpT <= 0) this.jumpT = 0.001;
      this.client?.send({ t: 'act', a: 'jump' });
      return true;
    }
    if (key === 'f') {
      this.world.pillowSwing(this.mine);
      this.client?.send({ t: 'act', a: 'pillow' });
      return true;
    }
    if (key === 'q') this.client?.send({ t: 'act', a: 'wave' });
    if (key === 'e') this.client?.send({ t: 'act', a: 'sit' });
    return false; // let the game animate wave / sit locally too
  }

  // ---------------------------------------------------------------- server messages

  private onMessage(m: ServerMsg) {
    switch (m.t) {
      case 'welcome':
        this.world.mySlot = m.you.slot;
        this.world.sync(m.players);
        this.setSong(m.song, m.votes);
        this.renderQueue(m.queue);
        this.renderCounts(m.counts);
        this.$.log.replaceChildren();
        m.chat.forEach((c) => this.addChat(c));
        this.applyYou(m.you, m.players);
        break;
      case 'you': this.applyYou(m.you); break;
      case 'joined':
        if (m.player.slot === this.you.slot) this.placeMe(m.player);
        else this.world.addPlayer(m.player);
        break;
      case 'left': {
        const push = m.reason === 'knocked' ? this.knockedOff.get(m.slot) ?? { dx: 0, dz: 0 } : null;
        this.knockedOff.delete(m.slot);
        if (m.slot === this.you.slot && this.mine) this.jumpOffMyself(m.slot, push);
        else if (push) this.world.knockOff(m.slot, push.dx, push.dz);
        else this.world.leave(m.slot);
        break;
      }
      case 'move': this.world.move(m.slot, m.x, m.z, m.tx, m.tz); break;
      case 'act':
        if (m.slot !== this.you.slot) this.world.act(m.slot, m.a);
        for (const h of m.hits ?? []) {
          // Knocked off the edge: the 'left' message that follows plays the fall.
          if (h.off) this.knockedOff.set(h.slot, { dx: h.dx, dz: h.dz });
          else if (h.slot === this.you.slot) {
            this.game.nudgePlayer(h.dx, h.dz);
            this.jumpT = 0.001;
            this.toast('Bonk! 🪶');
            // The server already moved us; don't echo it back as a "move"
            // (that would count as our own activity and dodge the idle rule).
            const p = this.game.player.root.position;
            Object.assign(this.lastSent, { x: p.x, z: p.z, tx: null, tz: null, moving: false });
          } else this.world.knock(h.slot, h.dx, h.dz);
        }
        break;
      case 'song': this.setSong(m.song, m.votes); this.renderQueue(m.queue); break;
      case 'queue': this.renderQueue(m.queue); break;
      case 'votes': this.renderVotes({ ...m.votes, mine: this.myVoteFor === this.song?.videoId }); break;
      case 'counts': this.renderCounts(m.counts); break;
      case 'chat': this.addChat(m.msg); break;
      case 'idleWarning': this.idleWarning(m.seconds); break;
      case 'notice': this.toast(m.text, m.kind === 'error'); break;
    }
  }

  private applyYou(you: You, players?: Player[]) {
    const had = this.you.slot;
    this.you = you;
    this.world.mySlot = you.slot;
    if (you.slot !== null && had !== you.slot) {
      const me = players?.find((p) => p.slot === you.slot);
      this.becomeAvatar(you.slot, me);
    } else if (you.slot === null && had !== null && this.mine) {
      this.mine = null;
      this.game.controlsEnabled = false;
      this.overview();
    }
    if (you.slot !== null) this.clearIdle();
    this.renderJoin();
  }

  private becomeAvatar(slot: number, at?: Player) {
    this.mine = new Avatar(slot, this.you.name ?? 'You', true);
    this.game.setCharacter(this.mine.char);
    this.game.controlsEnabled = true;
    if (at) this.placeMe(at);
    this.game.focusPlayer();
    this.lastSent.at = 0;
  }

  private placeMe(p: Player) {
    const pos = this.game.player.root.position;
    this.game.nudgePlayer(p.x - pos.x, p.z - pos.z);
    this.game.focusPlayer();
  }

  /** Our own avatar was removed (idle / left / knocked off): play the fall as a remote copy. */
  private jumpOffMyself(slot: number, push: { dx: number; dz: number } | null) {
    const pos = this.game.player.root.position;
    this.world.mySlot = null;
    this.world.addPlayer({ slot, uid: '', name: this.you.name ?? 'You', x: pos.x, z: pos.z, tx: null, tz: null });
    if (push) this.world.knockOff(slot, push.dx, push.dz);
    else this.world.leave(slot);
    this.mine = null;
    this.game.controlsEnabled = false;
  }

  // ---------------------------------------------------------------- per frame

  private frame(dt: number) {
    if (!this.mine || this.you.slot === null) return;
    // Local jump arc.
    if (this.jumpT > 0) {
      this.jumpT += dt;
      this.game.player.root.position.y = LoungeWorld.jumpHeight(this.jumpT);
      if (this.jumpT > 0.6) {
        this.jumpT = 0;
        this.game.player.root.position.y = 0;
      }
    }
    // Send our position when the walk target changes, every 250 ms while
    // moving, and once when we stop.
    const p = this.game.player.root.position;
    const t = this.game.walkTarget;
    const moving = Math.hypot(p.x - this.lastSent.x, p.z - this.lastSent.z) > 0.05 || (t && (t.x !== this.lastSent.tx || t.z !== this.lastSent.tz));
    const now = performance.now();
    const targetChanged = (t?.x ?? null) !== this.lastSent.tx || (t?.z ?? null) !== this.lastSent.tz;
    if (targetChanged || (moving && now - this.lastSent.at > 250) || (!moving && this.lastSent.moving)) {
      this.client?.send({ t: 'move', x: round(p.x), z: round(p.z), tx: t ? round(t.x) : null, tz: t ? round(t.z) : null });
      this.lastSent = { x: p.x, z: p.z, tx: t?.x ?? null, tz: t?.z ?? null, at: now, moving: !!moving };
    }
  }

  /** Spectator view of the whole island. */
  private overview() {
    this.game.setView(new THREE.Vector3(0, 9, 24), new THREE.Vector3(0, 1.5, 0));
  }

  // ---------------------------------------------------------------- UI

  private renderJoin() {
    const box = this.$.join;
    box.replaceChildren();
    const btn = (label: string, cls: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = cls;
      b.onclick = fn;
      return b;
    };
    const line = (text: string) => {
      const p = document.createElement('div');
      p.className = 'lg-note';
      p.textContent = text;
      return p;
    };
    const you = this.you;
    if (you.slot !== null) {
      box.append(line(`You're the ${avatarLabel(you.slot)} (#${you.slot + 1}). Stay active: 60 s idle and you jump off!`),
        btn('Leave the island', 'lg-btn', () => this.client?.send({ t: 'leave' })));
    } else if (you.waiting) {
      box.append(line(`You're #${you.waiting} in line for a spot on the island.`), btn('Leave the line', 'lg-btn', () => this.client?.send({ t: 'leave' })));
    } else if (!you.uid) {
      box.append(line('Watch the party, or sign in to get your own avatar, add songs, vote and chat.'));
      if (chatConfigured) box.append(btn('Sign in with Google', 'lg-btn primary', () => signIn().catch(() => this.toast('Sign-in failed.', true))));
    } else {
      box.append(btn(`🐻 Join the island`, 'lg-btn primary', () => this.client?.send({ t: 'join' })));
    }
  }

  private setSong(song: Song | null, votes: Votes) {
    const changed = song?.videoId !== this.song?.videoId || song?.startedAt !== this.song?.startedAt;
    this.song = song;
    if (changed) {
      this.player.play(song);
      this.world.setScreen(song);
      this.myVoteFor = votes.mine && song ? song.videoId : '';
    }
    this.renderSong();
    this.renderVotes({ ...votes, mine: this.myVoteFor === song?.videoId });
  }

  private renderSong() {
    this.$.song.textContent = this.song?.title ?? 'Nothing playing';
    this.$.by.textContent = this.song ? (this.song.byUid ? `requested by ${this.song.by}` : '🐻 Bear Den house music') : '';
  }

  private renderVotes(v: Votes) {
    this.votes = v;
    this.$.votes.textContent = `${v.count} / ${v.need} votes to skip`;
    const skip = this.$.skip as HTMLButtonElement;
    skip.disabled = !this.song || v.mine || !this.you.uid;
    skip.textContent = v.mine ? '✓ Voted' : '⏭ Vote skip';
    if (!v.mine) skip.onclick = () => {
      if (this.song) this.myVoteFor = this.song.videoId;
      this.client?.send({ t: 'vote' });
    };
  }

  private renderQueue(q: QueueItem[]) {
    this.$.qhead.textContent = q.length ? `Up next (${q.length}/${MAX_QUEUE})` : 'Queue is empty: house music plays until someone adds a song.';
    this.$.queue.replaceChildren(
      ...q.map((item) => {
        const li = document.createElement('li');
        const t = document.createElement('span');
        t.textContent = item.title;
        const by = document.createElement('small');
        by.textContent = ` · ${item.by}`;
        li.append(t, by);
        return li;
      }),
    );
  }

  private renderCounts(c: Counts) {
    this.$.counts.textContent = `👀 ${c.viewers} here · 🐻 ${c.players}/${MAX_SLOTS} on the island${c.waiting ? ` · ⏳ ${c.waiting} waiting` : ''}`;
  }

  private addChat(msg: ChatMsg) {
    const row = document.createElement('div');
    row.className = 'lg-msg' + (msg.uid === this.you.uid ? ' mine' : '');
    const b = document.createElement('b');
    b.textContent = msg.name;
    const span = document.createElement('span');
    span.textContent = ` ${msg.text}`;
    row.append(b, span);
    const log = this.$.log;
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.append(row);
    while (log.childElementCount > 100) log.firstElementChild?.remove();
    if (atBottom || msg.uid === this.you.uid) log.scrollTop = log.scrollHeight;
  }

  private idleWarning(seconds: number) {
    const el = this.$.idle;
    let left = seconds;
    const tick = () => {
      el.textContent = `💤 Still there? Move or chat within ${left}s or your avatar jumps off the island!`;
      if (left-- <= 0) this.clearIdle();
    };
    clearInterval(this.idleTimer);
    el.hidden = false;
    tick();
    this.idleTimer = window.setInterval(tick, 1000);
  }

  private clearIdle() {
    clearInterval(this.idleTimer);
    this.$.idle.hidden = true;
  }

  private status(text: string) {
    this.$.status.textContent = text;
    this.$.status.hidden = !text;
  }

  private toast(text: string, bad = false) {
    const t = this.$.toast;
    t.textContent = text;
    t.className = `lg-toast${bad ? ' bad' : ''}`;
    t.hidden = false;
    clearTimeout(Number(t.dataset.timer));
    t.dataset.timer = String(setTimeout(() => (t.hidden = true), 3500));
  }
}

const round = (v: number) => Math.round(v * 100) / 100;
