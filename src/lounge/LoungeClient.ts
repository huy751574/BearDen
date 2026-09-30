import type { ClientMsg, ServerMsg } from './protocol';

// WebSocket connection to the lounge server, with automatic reconnect and a
// server-clock offset (so everyone's YouTube player seeks to the same spot).

export type Status = 'connecting' | 'open' | 'closed';

export const LOUNGE_URL: string | null =
  import.meta.env.VITE_LOUNGE_URL || (import.meta.env.DEV ? 'ws://127.0.0.1:8787/ws' : null);

export class LoungeClient {
  private ws: WebSocket | null = null;
  private stopped = false;
  private retry = 0;
  private pingTimer = 0;
  private pingSent = 0;
  /** serverTime - Date.now(), in ms. */
  private offset = 0;
  onMessage: (m: ServerMsg) => void = () => {};
  onStatus: (s: Status) => void = () => {};

  constructor(private url: string, private token: () => Promise<string | null>, private guestName: string) {}

  connect() {
    this.stopped = false;
    this.onStatus('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = async () => {
      this.retry = 0;
      this.onStatus('open');
      await this.hello();
      clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.ping(), 20000);
    };
    ws.onmessage = (e) => {
      let m: ServerMsg;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.t === 'welcome') this.offset = m.now - Date.now();
      if (m.t === 'pong' && this.pingSent) {
        const rtt = Date.now() - this.pingSent;
        this.offset = m.now + rtt / 2 - Date.now();
      }
      this.onMessage(m);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      this.onStatus('closed');
      if (!this.stopped) setTimeout(() => this.connect(), Math.min(15000, 1000 * 2 ** this.retry++));
    };
  }

  /** (Re)introduce ourselves, e.g. after signing in. */
  async hello() {
    this.send({ t: 'hello', token: await this.token(), guestName: this.guestName });
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  /** Current server time in ms. */
  now() {
    return Date.now() + this.offset;
  }

  close() {
    this.stopped = true;
    clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }

  private ping() {
    this.pingSent = Date.now();
    this.send({ t: 'ping' });
  }
}
