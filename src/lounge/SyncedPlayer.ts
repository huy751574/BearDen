import { loadYouTubeApi, type YTPlayer } from '../ui/youtube';
import type { Song } from './protocol';

// YouTube player that follows the room: everyone plays the same video at the
// same position (song.startedAt is server time). Reports the video length and
// playback errors back to the server. The player stays visible (>= 200 px)
// as YouTube's embed policy requires.

const PLAYING = 1;

export class SyncedPlayer {
  private player: YTPlayer | null = null;
  private ready: Promise<void> | null = null;
  private song: Song | null = null;
  private reported = '';
  private driftTimer = 0;

  constructor(
    private host: HTMLElement,
    private serverNow: () => number,
    private events: { duration(videoId: string, seconds: number): void; error(videoId: string, code: number): void },
  ) {}

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
    if (load) p.loadVideoById({ videoId: s.videoId, startSeconds: at });
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
            playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
            events: {
              onReady: () => resolve(),
              onStateChange: (e: { data: number }) => {
                const s = this.song;
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
    this.player?.destroy();
    this.player = null;
    this.ready = null;
  }
}
