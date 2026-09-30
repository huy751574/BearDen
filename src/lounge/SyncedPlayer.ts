import { loadYouTubeApi, type YTPlayer } from '../ui/youtube';
import type { Song } from './protocol';

// YouTube player that follows the room: everyone plays the same video at the
// same position (song.startedAt is server time). Reports the video length and
// playback errors back to the server. The player is shown on the stage
// screen (ScreenVideo) and can't be clicked: nobody pauses the room's song,
// and if it ever pauses anyway it resumes. If the browser blocks autoplay,
// onBlocked(true) asks the page to show a "start the music" button.

const PLAYING = 1;
const PAUSED = 2;
const VOLUME_KEY = 'bearden.lounge.volume';

export class SyncedPlayer {
  private player: YTPlayer | null = null;
  private ready: Promise<void> | null = null;
  private song: Song | null = null;
  private reported = '';
  private driftTimer = 0;
  private startCheck = 0;
  private volume = 70;
  private muted = false;
  /** Called with true when the video should play but the browser didn't let it. */
  onBlocked: (blocked: boolean) => void = () => {};

  constructor(
    private host: HTMLElement,
    private serverNow: () => number,
    private events: { duration(videoId: string, seconds: number): void; error(videoId: string, code: number): void },
  ) {
    try {
      const v = Number(localStorage.getItem(VOLUME_KEY));
      if (localStorage.getItem(VOLUME_KEY) !== null && v >= 0 && v <= 100) this.volume = v;
    } catch {
      /* storage unavailable */
    }
  }

  get currentVolume() {
    return this.muted ? 0 : this.volume;
  }

  /** 0-100; 0 mutes. Remembered on this device. */
  setVolume(v: number) {
    this.volume = Math.round(Math.min(100, Math.max(0, v)));
    this.muted = this.volume === 0;
    try {
      localStorage.setItem(VOLUME_KEY, String(this.volume));
    } catch {
      /* storage unavailable */
    }
    this.applyVolume();
  }

  /** From a click (a user gesture), so the browser allows sound. */
  start() {
    this.player?.playVideo();
    this.applyVolume();
  }

  private applyVolume() {
    const p = this.player;
    if (!p) return;
    p.setVolume(this.volume);
    if (this.muted) p.mute();
    else p.unMute();
  }

  play(song: Song | null) {
    this.song = song;
    if (!song) {
      this.player?.stopVideo();
      return;
    }
    this.ensure().then(() => this.syncNow(true));
  }

  private expected() {
    return this.song ? (this.serverNow() - this.song.startedAt) / 1000 : 0;
  }

  private syncNow(load: boolean) {
    const s = this.song, p = this.player;
    if (!s || !p) return;
    const at = Math.max(0, this.expected());
    if (load) {
      p.loadVideoById({ videoId: s.videoId, startSeconds: at });
      // Still not playing a few seconds later: autoplay was blocked.
      clearTimeout(this.startCheck);
      this.startCheck = window.setTimeout(() => {
        if (this.song && this.player?.getPlayerState() !== PLAYING) this.onBlocked(true);
      }, 3500);
    }
    else if (Math.abs(p.getCurrentTime() - at) > 3 && at > 0) p.seekTo(at, true);
  }

  private ensure() {
    this.ready ??= loadYouTubeApi().then(
      (YT) =>
        new Promise<void>((resolve) => {
          const el = document.createElement('div');
          this.host.replaceChildren(el);
          this.player = new YT.Player(el, {
            width: '100%',
            height: '100%',
            host: 'https://www.youtube-nocookie.com',
            // No YouTube controls or keyboard: the room decides what plays.
            playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3 },
            events: {
              onReady: () => {
                this.applyVolume();
                resolve();
              },
              onStateChange: (e: { data: number }) => {
                const s = this.song;
                if (e.data === PLAYING) this.onBlocked(false);
                // Paused while the song should still be on: carry on.
                if (e.data === PAUSED && s && (s.duration === null || this.expected() < s.duration - 1)) {
                  setTimeout(() => this.player?.getPlayerState() === PAUSED && this.player.playVideo(), 300);
                }
                if (e.data === PLAYING && s && s.duration === null && this.reported !== s.videoId) {
                  const d = this.player!.getDuration();
                  if (d > 1) {
                    this.reported = s.videoId;
                    this.events.duration(s.videoId, d);
                  }
                }
              },
              onError: (e: { data: number }) => this.song && this.events.error(this.song.videoId, e.data),
            },
          });
          clearInterval(this.driftTimer);
          this.driftTimer = window.setInterval(() => this.syncNow(false), 5000);
        }),
    );
    return this.ready;
  }

  destroy() {
    clearInterval(this.driftTimer);
    clearTimeout(this.startCheck);
    this.player?.destroy();
    this.player = null;
    this.ready = null;
  }
}
