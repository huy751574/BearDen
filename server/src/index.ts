import { Lounge } from './Lounge';

// Worker entry: /ws upgrades to a WebSocket handled by the single "lounge"
// Durable Object. Everything else answers with a short status line.

export { Lounge };

export interface Env {
  LOUNGE: DurableObjectNamespace<Lounge>;
  FIREBASE_PROJECT_ID: string;
  ALLOW_GUESTS: string;
  ALLOWED_ORIGINS: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/ws') {
      return new Response('Bear Den Lounge server is running. Connect via /ws.', { headers: { 'content-type': 'text/plain' } });
    }
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
    const origin = req.headers.get('Origin') ?? '';
    if (!allowed.includes('*') && !allowed.includes(origin)) return new Response('Origin not allowed', { status: 403 });
    const stub = env.LOUNGE.get(env.LOUNGE.idFromName('lounge'));
    return stub.fetch(req);
  },
} satisfies ExportedHandler<Env>;
