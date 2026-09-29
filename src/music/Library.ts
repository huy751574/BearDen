import type { Manifest, SceneInfo, YoutubeVideo } from '../types';

// Every YouTube video in the game as a flat track list, the listener's
// "taste" settings, and the queue logic that picks what plays next.

export interface Track {
  key: string; // `${sceneId}/${videoId}`
  scene: SceneInfo;
  video: YoutubeVideo;
}

export type KindFilter = 'both' | 'instrumental' | 'lyrics';
export type RepeatMode = 'playlist' | 'one' | 'off';

export interface Taste {
  themes: string[]; // theme ids included in playlist / shuffle
  kind: KindFilter;
  repeat: RepeatMode;
  shuffle: boolean;
}

const STORAGE_KEY = 'bearden.taste.v1';

export class Library {
  readonly tracks: Track[];
  private byKey: Map<string, Track>;
  taste: Taste;
  current: Track | null = null;
  private history: Track[] = [];

  constructor(private manifest: Manifest) {
    const themeOrder = new Map(manifest.themes.map((t, i) => [t.id, i]));
    const scenes = [...manifest.scenes].sort(
      (a, b) => (themeOrder.get(a.theme)! - themeOrder.get(b.theme)!) || a.title.localeCompare(b.title),
    );
    this.tracks = scenes.flatMap((scene) =>
      scene.youtube.map((video) => ({ key: `${scene.id}/${video.id}`, scene, video })),
    );
    this.byKey = new Map(this.tracks.map((t) => [t.key, t]));
    this.taste = this.loadTaste();
  }

  get(key: string) {
    return this.byKey.get(key) ?? null;
  }

  /** First track of a scene, preferring the kind the listener likes. */
  trackForScene(scene: SceneInfo): Track | null {
    const own = this.tracks.filter((t) => t.scene.id === scene.id);
    return own.find((t) => this.kindOk(t)) ?? own[0] ?? null;
  }

  /** Tracks allowed by the taste settings. */
  pool(): Track[] {
    const themes = new Set(this.taste.themes);
    return this.tracks.filter((t) => themes.has(t.scene.theme) && this.kindOk(t));
  }

  setCurrent(track: Track) {
    if (this.current && this.current.key !== track.key) {
      this.history.push(this.current);
      if (this.history.length > 50) this.history.shift();
    }
    this.current = track;
  }

  /** What to play when the current video ends; null = stop. */
  next(auto: boolean): Track | null {
    const cur = this.current;
    if (auto && this.taste.repeat === 'one') return cur;
    if (auto && this.taste.repeat === 'off') return null;
    const pool = this.pool();
    if (!pool.length) return cur;

    if (this.taste.shuffle) {
      // Avoid anything played recently when the pool is big enough.
      const recent = new Set([cur, ...this.history.slice(-10)].filter(Boolean).map((t) => t!.key));
      const fresh = pool.filter((t) => !recent.has(t.key));
      const from = fresh.length ? fresh : pool.filter((t) => t.key !== cur?.key);
      return from.length ? from[Math.floor(Math.random() * from.length)] : cur;
    }
    // In order: the next pool track after the current one in the full list.
    const start = cur ? this.tracks.indexOf(cur) : -1;
    for (let i = 1; i <= this.tracks.length; i++) {
      const t = this.tracks[(start + i) % this.tracks.length];
      if (pool.includes(t)) return t;
    }
    return cur;
  }

  /** Previously played track (for the ◀ button). */
  back(): Track | null {
    const t = this.history.pop() ?? null;
    if (t) this.current = t; // don't push the track we're leaving
    return t;
  }

  /** A few other songs from the same theme, for the "you may like" row. */
  recommend(count = 3): Track[] {
    const cur = this.current;
    if (!cur) return [];
    const sameTheme = this.tracks.filter(
      (t) => t.scene.theme === cur.scene.theme && t.scene.id !== cur.scene.id,
    );
    // One per scene, in the preferred kind when available.
    const perScene = new Map<string, Track>();
    for (const t of sameTheme) {
      const prev = perScene.get(t.scene.id);
      if (!prev || (!this.kindOk(prev) && this.kindOk(t))) perScene.set(t.scene.id, t);
    }
    const list = [...perScene.values()];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.slice(0, count);
  }

  saveTaste() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.taste));
    } catch {
      /* storage unavailable: settings last for this visit only */
    }
  }

  private kindOk(t: Track) {
    return this.taste.kind === 'both' || t.video.kind === this.taste.kind;
  }

  private loadTaste(): Taste {
    const all = this.manifest.themes.map((t) => t.id);
    const fallback: Taste = { themes: all, kind: 'both', repeat: 'playlist', shuffle: false };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Taste> | null;
      if (!saved) return fallback;
      const themes = (saved.themes ?? all).filter((id) => all.includes(id));
      return { ...fallback, ...saved, themes: themes.length ? themes : all };
    } catch {
      return fallback;
    }
  }
}

/** "Title 🌸 (Lyrics) | long SEO tail" -> "Title 🌸 (Lyrics)" */
export function shortTitle(title: string, max = 46) {
  const head = title.split(/\s[|—]\s/)[0].trim();
  return head.length > max ? head.slice(0, max - 1).trimEnd() + '…' : head;
}
