import { shortTitle, type Library, type Track } from '../music/Library';
import { loadYouTubeApi, type YTPlayer } from './youtube';

// "Bear Den Radio": recommendations row, then the YouTube player, then
// prev/next controls. YouTube's policy requires the embedded player to stay
// visible and at least 200x200, so the screen is never hidden or shrunk.

export interface RadioEvents {
  /** User picked a track (recommendation, ◀ or ▶). */
  pick(track: Track): void;
  /** Current video finished playing. */
  ended(): void;
  /** ⚙ pressed. */
  openTaste(): void;
}

export class RadioCard {
  readonly el = document.createElement('div');
  private recsEl: HTMLElement;
  private titleEl: HTMLElement;
  private screen: HTMLElement;
  private status: HTMLElement;
  private modeEl: HTMLElement;
  private player: YTPlayer | null = null;
  private playerReady: Promise<void> | null = null;
  private track: Track | null = null;
  private token = 0;

  constructor(private lib: Library, private events: RadioEvents) {
    this.el.className = 'radio';
    this.el.innerHTML = `
      <div class="radio-head">
        <span class="label">Bear Den Radio</span>
        <span class="mode"></span>
        <button class="icon taste" aria-label="Music settings" title="Your taste">⚙</button>
      </div>
      <div class="recs-label">You may also like</div>
      <div class="recs"></div>
      <div class="song"></div>
      <div class="screen"></div>
      <div class="controls">
        <button class="prev" aria-label="Previous song">◀</button>
        <span class="status"></span>
        <button class="next" aria-label="Next song">▶</button>
      </div>`;
    const $ = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    this.recsEl = $('.recs');
    this.titleEl = $('.song');
    this.screen = $('.screen');
    this.status = $('.status');
    this.modeEl = $('.mode');
    $('.taste').onclick = () => this.events.openTaste();
    $<HTMLButtonElement>('.prev').onclick = () => {
      const t = this.lib.back();
      if (t) this.events.pick(t);
    };
    $<HTMLButtonElement>('.next').onclick = () => {
      const t = this.lib.next(false);
      if (t) this.events.pick(t);
    };
  }

  /** Show and play a track (reuses the player so autoplay keeps working). */
  play(track: Track) {
    const same = this.track?.video.id === track.video.id;
    this.track = track;
    this.el.hidden = false;
    this.renderInfo();
    if (this.player && this.playerReady) {
      const player = this.player;
      this.playerReady.then(() => {
        if (same) {
          player.seekTo(0, true);
          player.playVideo();
        } else {
          player.loadVideoById(track.video.id);
        }
      });
    } else {
      this.mount(track.video.id);
    }
  }

  /** Scene without a YouTube video yet: show the card with a note, no player. */
  idle(scene: { title: string }) {
    this.stop();
    this.el.hidden = false;
    this.titleEl.textContent = scene.title;
    this.status.textContent = 'not on YouTube yet';
    this.recsEl.replaceChildren();
    this.el.querySelector<HTMLElement>('.recs-label')!.hidden = true;
    this.screen.textContent = 'This song is not on YouTube yet. Press ▶ for the next one.';
  }

  /** Stopped at the end of a video with repeat = off. */
  finished() {
    this.status.textContent = 'Finished · press ▶ for more';
  }

  stop() {
    this.token++;
    this.track = null;
    this.el.hidden = true;
    this.player?.destroy();
    this.player = null;
    this.playerReady = null;
  }

  /** Re-render labels after taste settings change. */
  refresh() {
    this.renderInfo();
  }

  private renderInfo() {
    const t = this.track;
    if (!t) return;
    const taste = this.lib.taste;
    this.titleEl.textContent = t.video.title;
    this.titleEl.title = t.video.title;
    this.status.textContent = `${t.scene.title} · ${t.video.kind}`;
    const repeat = { playlist: 'Playlist', one: 'Repeat one', off: 'Stop at end' }[taste.repeat];
    this.modeEl.textContent = `${taste.shuffle ? 'Shuffle · ' : ''}${repeat}`;

    this.recsEl.replaceChildren(
      ...this.lib.recommend(3).map((r) => {
        const b = document.createElement('button');
        b.className = 'rec';
        b.title = r.video.title;
        const img = document.createElement('img');
        img.src = `media/${r.scene.id}/thumb.webp`;
        img.alt = '';
        img.loading = 'lazy';
        const cap = document.createElement('span');
        cap.textContent = shortTitle(r.video.title, 34);
        b.append(img, cap);
        b.onclick = () => this.events.pick(r);
        return b;
      }),
    );
    this.el.querySelector<HTMLElement>('.recs-label')!.hidden = !this.recsEl.childElementCount;
  }

  private async mount(videoId: string) {
    const token = ++this.token;
    this.screen.replaceChildren();
    const host = document.createElement('div');
    this.screen.append(host);
    try {
      const YT = await loadYouTubeApi();
      if (token !== this.token) return; // stopped while loading
      this.playerReady = new Promise((ready) => {
        this.player = new YT.Player(host, {
          width: '100%',
          height: '100%',
          videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => ready(),
            onStateChange: (e: { data: number }) => {
              if (e.data === YT.PlayerState.ENDED) this.events.ended();
            },
          },
        });
      });
    } catch {
      this.screen.textContent = 'Could not reach YouTube.';
    }
  }
}
