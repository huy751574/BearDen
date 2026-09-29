import type { ThemeInfo } from '../types';
import type { KindFilter, Library, RepeatMode } from '../music/Library';

// "Your taste" dialog: which themes feed the playlist/shuffle, lyrics or not,
// and what happens when a song ends. Saved in the browser (localStorage).

export class TastePanel {
  private dialog = document.createElement('dialog');
  private countEl: HTMLElement;

  constructor(
    private lib: Library,
    themes: ThemeInfo[],
    private onChange: () => void,
    private onPlayMix: () => void,
  ) {
    const d = this.dialog;
    d.className = 'taste-dialog';
    d.innerHTML = `
      <form method="dialog">
        <header><h2>Your taste</h2><button class="icon close" value="close" aria-label="Close">✕</button></header>

        <fieldset>
          <legend>Themes in my mix <span class="quick"><button type="button" data-all="1">All</button><button type="button" data-all="0">None</button></span></legend>
          <div class="theme-checks"></div>
        </fieldset>

        <fieldset>
          <legend>Songs</legend>
          <div class="seg">
            <label><input type="radio" name="kind" value="both"> Both</label>
            <label><input type="radio" name="kind" value="instrumental"> Instrumental</label>
            <label><input type="radio" name="kind" value="lyrics"> With lyrics</label>
          </div>
        </fieldset>

        <fieldset>
          <legend>When a song ends</legend>
          <div class="seg">
            <label><input type="radio" name="repeat" value="playlist"> Play next</label>
            <label><input type="radio" name="repeat" value="one"> Repeat this song</label>
            <label><input type="radio" name="repeat" value="off"> Stop</label>
          </div>
          <label class="check"><input type="checkbox" name="shuffle"> Shuffle (random order)</label>
        </fieldset>

        <footer>
          <span class="count"></span>
          <button type="button" class="primary play-mix">▶ Play my mix</button>
        </footer>
      </form>`;

    const checks = d.querySelector('.theme-checks')!;
    for (const t of themes) {
      const label = document.createElement('label');
      label.className = 'check';
      const box = Object.assign(document.createElement('input'), { type: 'checkbox', name: 'theme', value: t.id });
      label.append(box, ` ${t.name}`);
      checks.append(label);
    }
    this.countEl = d.querySelector('.count')!;

    d.addEventListener('change', () => this.read());
    d.querySelectorAll<HTMLButtonElement>('[data-all]').forEach((b) => {
      b.onclick = () => {
        d.querySelectorAll<HTMLInputElement>('input[name=theme]').forEach((c) => (c.checked = b.dataset.all === '1'));
        this.read();
      };
    });
    d.querySelector<HTMLButtonElement>('.play-mix')!.onclick = () => {
      d.close();
      this.onPlayMix();
    };
    // Click on the backdrop closes the dialog.
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    });
    document.body.append(d);
  }

  open() {
    const { taste } = this.lib;
    const d = this.dialog;
    d.querySelectorAll<HTMLInputElement>('input[name=theme]').forEach((c) => (c.checked = taste.themes.includes(c.value)));
    d.querySelector<HTMLInputElement>(`input[name=kind][value=${taste.kind}]`)!.checked = true;
    d.querySelector<HTMLInputElement>(`input[name=repeat][value=${taste.repeat}]`)!.checked = true;
    d.querySelector<HTMLInputElement>('input[name=shuffle]')!.checked = taste.shuffle;
    this.updateCount();
    d.showModal();
  }

  private read() {
    const d = this.dialog;
    const val = (name: string) => d.querySelector<HTMLInputElement>(`input[name=${name}]:checked`)?.value;
    this.lib.taste = {
      themes: [...d.querySelectorAll<HTMLInputElement>('input[name=theme]:checked')].map((c) => c.value),
      kind: (val('kind') ?? 'both') as KindFilter,
      repeat: (val('repeat') ?? 'playlist') as RepeatMode,
      shuffle: d.querySelector<HTMLInputElement>('input[name=shuffle]')!.checked,
    };
    this.lib.saveTaste();
    this.updateCount();
    this.onChange();
  }

  private updateCount() {
    const n = this.lib.pool().length;
    this.countEl.textContent = n ? `${n} songs in your mix` : 'Pick at least one theme';
    this.dialog.querySelector<HTMLButtonElement>('.play-mix')!.disabled = n === 0;
  }
}
