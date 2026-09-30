import type { Variant } from '../games/catalog';

// On-screen UI for the mini-games: top bar (title, timer, score, hearts),
// start / result cards, a timing meter, Simon pads, a big tap button for
// touch screens, a centre icon and toasts. All text is set with textContent.

export class GameHud {
  readonly el = document.createElement('div');
  private bar: HTMLElement;
  private titleEl: HTMLElement;
  private timeEl: HTMLElement;
  private scoreEl: HTMLElement;
  private livesEl: HTMLElement;
  private progEl: HTMLElement;
  private card: HTMLElement;
  private meterEl: HTMLElement;
  private needle: HTMLElement;
  private zone: HTMLElement;
  private padsEl: HTMLElement;
  private actionBtn: HTMLButtonElement;
  private bigEl: HTMLElement;
  private toastEl: HTMLElement;
  private toastTimer = 0;
  onClose: (() => void) | null = null;

  constructor() {
    this.el.className = 'game-hud';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="g-bar">
        <span class="g-title"></span>
        <span class="g-prog"></span>
        <span class="g-time"></span>
        <span class="g-score"></span>
        <span class="g-lives"></span>
        <button class="g-close" aria-label="Quit game">✕</button>
      </div>
      <div class="g-big"></div>
      <div class="g-meter"><div class="g-zone"></div><div class="g-needle"></div></div>
      <div class="g-pads"></div>
      <button class="g-action"></button>
      <div class="g-toast"></div>
      <div class="g-card"></div>`;
    const $ = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(s)!;
    this.bar = $('.g-bar');
    this.titleEl = $('.g-title');
    this.timeEl = $('.g-time');
    this.scoreEl = $('.g-score');
    this.livesEl = $('.g-lives');
    this.progEl = $('.g-prog');
    this.card = $('.g-card');
    this.meterEl = $('.g-meter');
    this.needle = $('.g-needle');
    this.zone = $('.g-zone');
    this.padsEl = $('.g-pads');
    this.actionBtn = $<HTMLButtonElement>('.g-action');
    this.bigEl = $('.g-big');
    this.toastEl = $('.g-toast');
    $('.g-close').onclick = () => this.onClose?.();
    this.reset();
  }

  private reset() {
    this.meter(null);
    this.pads(null);
    this.action(null);
    this.big(null);
    this.progress('');
    this.toastEl.hidden = true;
  }

  // ---------------------------------------------------------------- cards

  ready(v: Variant, best: number, onStart: () => void) {
    this.el.hidden = false;
    this.reset();
    this.bar.hidden = true;
    this.showCard(v.title, v.hint, best ? `Best: ${best}` : 'No best score yet', [
      ['▶ Start', onStart, 'primary'],
      ['Close', () => this.onClose?.(), ''],
    ]);
  }

  playing(v: Variant) {
    this.card.hidden = true;
    this.bar.hidden = false;
    this.titleEl.textContent = v.title;
  }

  over(score: number, best: number, isBest: boolean, won: boolean, onRetry: () => void) {
    this.reset();
    this.bar.hidden = true;
    const head = won ? (isBest ? '🏆 New best!' : '🎉 Well done!') : '💫 Game over';
    this.showCard(head, `Score: ${score}`, `Best: ${best}`, [
      ['↻ Play again', onRetry, 'primary'],
      ['Close', () => this.onClose?.(), ''],
    ]);
  }

  hide() {
    this.el.hidden = true;
    this.reset();
  }

  private showCard(title: string, body: string, foot: string, buttons: [string, () => void, string][]) {
    this.card.replaceChildren();
    const h = document.createElement('h3');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = body;
    const f = document.createElement('div');
    f.className = 'g-foot';
    f.textContent = foot;
    const row = document.createElement('div');
    row.className = 'g-buttons';
    for (const [label, cb, cls] of buttons) {
      const b = document.createElement('button');
      b.textContent = label;
      if (cls) b.className = cls;
      b.onclick = cb;
      row.append(b);
    }
    this.card.append(h, p, f, row);
    this.card.hidden = false;
    (row.firstElementChild as HTMLButtonElement | null)?.focus();
  }

  // ---------------------------------------------------------------- live widgets

  stats(s: { score: number; time: number | null; lives: number | null }) {
    this.scoreEl.textContent = `★ ${s.score}`;
    this.timeEl.hidden = s.time === null;
    if (s.time !== null) this.timeEl.textContent = `⏱ ${Math.ceil(s.time)}`;
    this.livesEl.hidden = s.lives === null;
    if (s.lives !== null) this.livesEl.textContent = '❤️'.repeat(Math.max(0, s.lives)) + '🤍'.repeat(Math.max(0, 3 - s.lives));
  }

  progress(text: string) {
    this.progEl.textContent = text;
    this.progEl.hidden = !text;
  }

  toast(text: string, kind: 'good' | 'bad' | 'info') {
    this.toastEl.textContent = text;
    this.toastEl.className = `g-toast ${kind}`;
    this.toastEl.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.hidden = true), kind === 'info' ? 3500 : 1100);
  }

  big(icon: string | null) {
    this.bigEl.hidden = !icon;
    if (icon) this.bigEl.textContent = icon;
  }

  meter(needle: number | null, a = 0, b = 0) {
    this.meterEl.hidden = needle === null;
    if (needle === null) return;
    this.needle.style.left = `${needle * 100}%`;
    this.zone.style.left = `${a * 100}%`;
    this.zone.style.width = `${(b - a) * 100}%`;
  }

  action(label: string | null, cb?: () => void) {
    this.actionBtn.hidden = !label;
    if (label) {
      this.actionBtn.textContent = label;
      this.actionBtn.onclick = (e) => {
        e.stopPropagation();
        cb?.();
      };
    }
  }

  pads(labels: string[] | null, cb?: (i: number) => void) {
    this.padsEl.replaceChildren();
    this.padsEl.hidden = !labels;
    labels?.forEach((l, i) => {
      const b = document.createElement('button');
      b.textContent = l;
      b.setAttribute('aria-label', `Pad ${i + 1}`);
      const key = document.createElement('small');
      key.textContent = String(i + 1);
      b.append(key);
      b.onclick = (e) => {
        e.stopPropagation();
        cb?.(i);
      };
      // Drop the effect class once it has played, so nothing can replay it later.
      b.addEventListener('animationend', () => b.classList.remove('demo', 'tap'));
      this.padsEl.append(b);
    });
  }

  /** 'demo' = the game showing the sequence (big glow); 'tap' = the player pressing (short press-down). */
  flashPad(i: number, kind: 'demo' | 'tap' = 'tap') {
    const b = this.padsEl.children[i] as HTMLElement | undefined;
    if (!b) return;
    b.classList.remove('demo', 'tap');
    void b.offsetWidth; // restart the animation if the same pad fires again
    b.classList.add(kind);
  }

  /** Dim the pads while the sequence plays; brighten them for the player's turn. */
  padsState(state: 'watch' | 'input') {
    this.padsEl.classList.toggle('watch', state === 'watch');
    this.padsEl.classList.toggle('input', state === 'input');
  }
}
