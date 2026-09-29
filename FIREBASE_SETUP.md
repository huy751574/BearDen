# Chat setup (Firebase, about 10 minutes)

The chat uses Firebase Realtime Database plus Google sign-in. Everything below
is on Firebase's free Spark plan. You do these steps yourself in the Firebase
console, because they need your Google account.

## 1. Create the project
1. Go to https://console.firebase.google.com and click **Create a project**. Name it something like `bear-den-sim`.
   Google Analytics is not needed.
2. In the project overview, click the **Web** icon (`</>`) to add a web app. Give it a nickname and skip Hosting.
3. Firebase shows a `firebaseConfig` object. Keep that page open for step 4.

## 2. Turn on Google sign-in
1. Go to **Build → Authentication → Get started → Sign-in method → Google → Enable**.
   Pick a support email and save.
2. Under **Authentication → Settings → Authorized domains**, `localhost` is already listed.
   When you deploy (Netlify, GitHub Pages…), add that domain here too.

## 3. Create the database and paste the rules
1. Go to **Build → Realtime Database → Create database**, pick the region closest to your players,
   and start in **locked mode**.
2. Open the **Rules** tab, replace everything with the contents of `database.rules.json`
   from this project, and click **Publish**.

   What the rules do:
   - Anyone can **read** a room. Only signed-in users can **post**.
   - Each room has only 100 message slots (`0`–`99`). New messages overwrite the oldest,
     so a room can never hold more than **100 messages**.
   - Messages are at most 300 characters, stamped with the server time, and tied to the
     sender's account (nobody can post as someone else).

## 4. Connect the game
1. Copy `.env.example` to `.env.local` in the project folder.
2. Fill it in from the `firebaseConfig` in step 1:

   | .env.local | firebaseConfig |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_DATABASE_URL` | `databaseURL` (shown on the Realtime Database page, e.g. `https://bear-den-sim-default-rtdb.asia-southeast1.firebasedatabase.app`) |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

3. Restart `npm run dev`. The chat box shows **Sign in with Google to chat**.

## Rooms
There is one room per theme (`rooms/adventure`, `rooms/wuxia`…). The room switches
automatically when the radio travels to a scene in another theme.

## Moderation
To delete a message, open **Realtime Database → Data**, find
`rooms/<theme>/slots/<n>` and delete it. To ban someone, open **Authentication → Users**
and disable their account.
