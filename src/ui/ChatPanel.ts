import {
  chatConfigured, MAX_TEXT, ROOM_LIMIT, onUserChange, send, signIn, signOut, subscribe,
  type ChatMessage, type ChatUser,
} from '../chat/ChatService';

// Collapsible chat box, one room per theme. Reading is open to everyone;
// sending needs Google sign-in. All message text is inserted as textContent.

const COLLAPSED_KEY = 'bearden.chat.collapsed';

export class ChatPanel {
  readonly el = document.createElement('section');
  private log: HTMLElement;
  private form: HTMLFormElement;
  private input: HTMLInputElement;
  private roomLabel: HTMLElement;
  private account: HTMLElement;
  private user: ChatUser | null = null;
  private room = '';
  private unsubscribe: (() => void) | null = null;
  private lastSent = 0;

  constructor() {
    this.el.className = 'chat';
    this.el.innerHTML = `
      <button class="chat-toggle" aria-expanded="true"><span>💬 Chat</span> <span class="room"></span></button>
      <div class="chat-body">
        <div class="chat-log" aria-live="polite"></div>
        <form class="chat-form">
          <input type="text" maxlength="${MAX_TEXT}" placeholder="Say hi to fellow bears…" aria-label="Message" autocomplete="off" />
          <button type="submit">Send</button>
        </form>
        <div class="chat-account"></div>
      </div>`;
    const $ = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(s)!;
    this.log = $('.chat-log');
    this.form = $<HTMLFormElement>('.chat-form');
    this.input = $<HTMLInputElement>('.chat-form input');
    this.roomLabel = $('.room');
    this.account = $('.chat-account');

    const toggle = $<HTMLButtonElement>('.chat-toggle');
    const setCollapsed = (c: boolean) => {
      this.el.classList.toggle('collapsed', c);
      toggle.setAttribute('aria-expanded', String(!c));
      try { localStorage.setItem(COLLAPSED_KEY, c ? '1' : '0'); } catch { /* ignore */ }
    };
    let saved: string | null = null;
    try { saved = localStorage.getItem(COLLAPSED_KEY); } catch { /* ignore */ }
    setCollapsed(saved ? saved === '1' : matchMedia('(max-width: 640px)').matches);
    toggle.onclick = () => setCollapsed(!this.el.classList.contains('collapsed'));

    this.form.onsubmit = (e) => {
      e.preventDefault();
      this.submit();
    };

    if (!chatConfigured) {
      this.form.hidden = true;
      this.log.innerHTML =
        '<p class="chat-note">Chat isn\'t connected yet. Add your Firebase keys to <code>.env.local</code> (see FIREBASE_SETUP.md).</p>';
      return;
    }
    onUserChange((u) => {
      this.user = u;
      this.renderAccount();
    }).catch(() => this.note('Could not reach the chat server.'));
    this.renderAccount();
  }

  /** Switch to a theme's room (no-op if already there). */
  setRoom(themeId: string, themeName: string) {
    this.roomLabel.textContent = `· ${themeName}`;
    if (!chatConfigured || themeId === this.room) return;
    this.room = themeId;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.log.replaceChildren();
    const room = themeId;
    subscribe(room, (msgs) => {
      if (room === this.room) this.render(msgs);
    })
      .then((unsub) => {
        if (room === this.room) this.unsubscribe = unsub;
        else unsub();
      })
      .catch(() => this.note('Could not load messages.'));
  }

  private async submit() {
    const text = this.input.value.trim();
    if (!text || !this.user) return;
    if (Date.now() - this.lastSent < 1500) return; // light client-side throttle
    this.lastSent = Date.now();
    this.input.value = '';
    try {
      await send(this.room, text);
    } catch {
      this.input.value = text;
      this.note('Message not sent. Try again.');
    }
  }

  private render(msgs: ChatMessage[]) {
    const nearBottom = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 40;
    this.log.replaceChildren(
      ...msgs.map((m) => {
        const row = document.createElement('div');
        row.className = 'msg' + (m.uid === this.user?.uid ? ' mine' : '');
        if (m.photo) {
          const img = Object.assign(document.createElement('img'), { src: m.photo, alt: '', referrerPolicy: 'no-referrer' });
          row.append(img);
        }
        const body = document.createElement('div');
        const meta = document.createElement('div');
        meta.className = 'meta';
        const name = document.createElement('b');
        name.textContent = m.name;
        const time = document.createElement('time');
        time.textContent = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        meta.append(name, ' ', time);
        const text = document.createElement('div');
        text.className = 'text';
        text.textContent = m.text;
        body.append(meta, text);
        row.append(body);
        return row;
      }),
    );
    if (!msgs.length) this.note(`No messages yet. Rooms keep the last ${ROOM_LIMIT}.`);
    if (nearBottom || msgs.at(-1)?.uid === this.user?.uid) this.log.scrollTop = this.log.scrollHeight;
  }

  private renderAccount() {
    this.account.replaceChildren();
    this.form.hidden = !this.user;
    if (this.user) {
      const out = Object.assign(document.createElement('button'), { className: 'link', textContent: 'Sign out' });
      out.onclick = () => signOut();
      this.account.append(`Signed in as ${this.user.name} · `, out);
    } else {
      const btn = Object.assign(document.createElement('button'), { className: 'signin', textContent: 'Sign in with Google to chat' });
      btn.onclick = () => signIn().catch(() => this.note('Sign-in failed.'));
      this.account.append(btn);
    }
  }

  private note(text: string) {
    const p = document.createElement('p');
    p.className = 'chat-note';
    p.textContent = text;
    this.log.append(p);
  }
}
