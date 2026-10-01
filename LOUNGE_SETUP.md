# Bear Den Lounge setup (Cloudflare, about 10 minutes)

The lounge is a multiplayer room. One small server on Cloudflare (a Worker
plus a Durable Object, code in `server/`) keeps everyone in sync:

- 50 avatar slots: the game's 5 characters (bear, fox, capybara, cat idol,
  moon bunny) x 10 accessories, all different. Everyone else
  can watch and wait in line.
- 60 seconds with no action or chat and your avatar jumps off the island; the
  next person in line gets the spot.
- A shared YouTube queue played in sync for everyone. Rules: any embeddable
  video up to 10 minutes, one queued song per person, 30 songs max. When the
  queue is empty, Bear Den songs play.
- Vote to skip: the song is skipped at 20% of everyone in the room or 50% of
  active players, whichever is fewer.
- Actions: walk, jump (Space), pillow hit (F, knocks nearby avatars back),
  wave (Q), sit (E). Lounge chat keeps the last 100 messages.
- Joining, adding songs, voting and chatting need Google sign-in (the same
  Firebase login as the scene chat). Anyone can watch.

## 1. Cloudflare account
Sign up for free at https://dash.cloudflare.com/sign-up. The free Workers plan is enough to start.

## 2. Log in and deploy (from the project folder)
```bash
cd server
npm install
npx wrangler login
npx wrangler deploy
```
`wrangler login` opens your browser to approve access. `deploy` prints the
server address, for example `https://bearden-lounge.<your-subdomain>.workers.dev`.
Open it in a browser: it should say "Bear Den Lounge server is running".

`server/wrangler.toml` already has your Firebase project id (to check Google
sign-ins) and allows connections only from `https://huy751574.github.io` and
local development.

## 3. Point the website at it
Your lounge URL is the address above with `wss://` and `/ws`:
`wss://bearden-lounge.<your-subdomain>.workers.dev/ws`

- **Live site:** in GitHub, go to repo **Settings → Secrets and variables →
  Actions → Variables → New repository variable**. Name it
  `VITE_LOUNGE_URL` and set the value to that URL, then re-run the deploy
  workflow (or push anything).
- **Local development:** optional. Without `VITE_LOUNGE_URL`, `npm run dev`
  connects to a local server. Start one with
  `cd server && npx wrangler dev --var ALLOW_GUESTS:true`, where guests may
  join without signing in.

## Costs
The free plan includes 100,000 Durable Object requests a day. Incoming
WebSocket messages count 20 to 1, and outgoing messages are free. The client
only sends when something changes (not a constant stream), so a lively room
of dozens of people fits comfortably. A room that is packed around the clock
could pass the free limit; the Workers Paid plan ($5/month) then covers
millions of requests. Check usage in the Cloudflare dashboard under
**Workers & Pages → bearden-lounge → Metrics**.

## House music
`tools/build_house.py` writes `server/src/house.json` from your channel's
songs (10 minutes or shorter). After adding new songs, run it again, then
`npx wrangler deploy` again.

## Moderation
- Chat and the queue are in the room's storage. To clear everything, delete
  and redeploy the Worker. A moderation command could be added later.
- The server rejects links it can't embed, songs longer than 10 minutes, and
  spam (rate limits on chat, moves and actions).
