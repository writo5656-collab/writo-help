# AI tutor server (proxy)

The AI tutor powers **free-talk calls** and open conversation. Everything else in Nihongo works without it.

You have three ways to connect it (Settings → AI tutor):

| Option | Cost | Setup | Safety |
|---|---|---|---|
| **Gemini key in the app** | Free (daily limit) | 2 minutes | Key is stored on your phone |
| **Claude key in the app** | Paid per use | 2 minutes | Key is stored on your phone |
| **Your own proxy (this folder)** | Free with Gemini, or paid with Claude | About 15 minutes | Key never leaves your server — safest |

The keys in the app are fine for a phone only you use. Use the proxy if anyone else might use the app or the phone.

**Status:** this code compiles but has not been tested against a live key. Treat the first run as a test.

---

## Fastest: Gemini key in the app (free)

1. Open **https://aistudio.google.com** and sign in with a Google account.
2. Click **Get API key** → **Create API key**, and copy it.
3. In Nihongo: **Settings → AI tutor → Gemini key**, paste it, tap **Test connection**.

Google's free tier has a daily limit. If you hit it, the tutor says so; try again later.

---

## Phone only (no computer, no Termux)

Everything happens in your phone's browser. Use Chrome and turn on **Desktop site** (⋮ menu) if a page looks cramped.

1. **Get a free Gemini key:** aistudio.google.com → **Get API key** → **Create API key** → copy it.
2. **Create a Supabase project:** supabase.com → sign up (free) → **New project** → any name and password → wait until it's ready.
3. **Create the function:** in your project, open **Edge Functions** → **Deploy a new function** → **Via Editor**.
   - Name it `tutor`.
   - Delete the example code. Paste the **whole** of [`server/phone/tutor.ts`](phone/tutor.ts) (on GitHub, open the file and use the copy button).
   - Tap **Deploy function** and wait about 30 seconds.
4. **Add secrets:** **Edge Functions → Secrets** → add `GEMINI_API_KEY` = your key, and `APP_TOKEN` = any long passphrase you invent → **Save**.
5. **Allow the app to call it:** open the `tutor` function → **Details / Settings** → turn **off** "Verify JWT" (wording may differ slightly) → save.
   If you can't find that switch, go to **Project Settings → API Keys**, copy the **anon** (legacy) key, and paste it later into the app's *Supabase key* box.
6. **Copy the address:** on the function page you'll see `https://YOUR-PROJECT.supabase.co/functions/v1/tutor`.
7. **Connect the app:** Nihongo → **Settings → AI tutor → My proxy** → paste the address and your passphrase (and the anon key if step 5 needed it) → **Test connection**.

If the test shows an error, the message tells you which step to recheck.

## Your own free server (proxy) — with a computer, step by step

You need a computer once, for about 15 minutes. After that, nothing runs on your computer.

### 1. Get a free AI key
Do the Gemini steps above, but keep the key for the server instead of pasting it into the app. To use Claude instead, create a key at **https://console.anthropic.com** → API keys (paid).

### 2. Create a free Supabase project
1. Go to **https://supabase.com** and sign up (free plan).
2. Click **New project**, give it any name and a database password, and wait for it to finish.
3. Open **Project Settings → General** and copy the **Reference ID** (looks like `abcdefghijklmnop`).

### 3. Install the Supabase tool on your computer
- Windows: install **Scoop** (scoop.sh), then run `scoop install supabase`
- Mac: install **Homebrew** (brew.sh), then run `brew install supabase/tap/supabase`
- Or with Node.js installed: `npx supabase --help` (prefix the commands below with `npx`)

### 4. Deploy
Open a terminal **in this `server` folder** and run:

```bash
supabase login
supabase link --project-ref YOUR_REFERENCE_ID
supabase secrets set GEMINI_API_KEY=your-gemini-key APP_TOKEN=make-up-a-long-passphrase
supabase functions deploy tutor --no-verify-jwt
```

To use Claude instead, replace `GEMINI_API_KEY=…` with `ANTHROPIC_API_KEY=…`.

The last command prints an address like:
`https://YOUR_REFERENCE_ID.supabase.co/functions/v1/tutor`

### 5. Connect the app
**Settings → AI tutor → My proxy**: paste the address, type the same passphrase, then tap **Test connection**.

`APP_TOKEN` stops strangers who find the address from using up your key. Keep it private.

---

## Changing things later
- **Model:** set `GEMINI_MODEL` with `supabase secrets set GEMINI_MODEL=…`, or edit the model name in `supabase/functions/tutor/index.ts`.
- **Tutor style:** edit the rules in `index.ts`, then redeploy with `supabase functions deploy tutor --no-verify-jwt`.
- **Free limits:** Supabase's free plan includes far more function calls than one learner needs. Gemini's free tier has a daily request limit set by Google.

## Swapping providers
The app only expects this JSON back: `{ "jp", "kana", "en", "correction": { "said", "better", "why" } | null }`. Any service that returns that shape can replace this function.
