# AI tutor proxy

The AI tutor is the only part of Nihongo that needs an outside service. Everything else works offline.

**Why a proxy?** The tutor uses Claude through the Anthropic API, which needs a paid API key. Putting that key inside a phone app is unsafe (anyone with the APK could extract it), so the key lives in a tiny server-side function instead. The app only knows the function's web address.

**Status: written but not yet deployed or tested against a live key.** Treat the first run as a test.

## One-time setup (about 15 minutes)

1. **Get an API key** at https://console.anthropic.com → API keys. Add a little credit. A tutor conversation costs a few cents at most.
2. **Create a free Supabase project** at https://supabase.com (or use an existing one).
3. **Install the Supabase CLI** on a computer: https://supabase.com/docs/guides/cli
4. In a terminal, from this `server` folder:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   APP_TOKEN=choose-a-long-passphrase
   supabase functions deploy tutor --no-verify-jwt
   ```

5. The last command prints an address like `https://YOUR_PROJECT_REF.supabase.co/functions/v1/tutor`.
6. In the app: **Settings → AI tutor** → paste that address, type the same passphrase, tap **Test connection**.

`APP_TOKEN` stops strangers who find the address from spending your credit. Keep it private.

## Changing the model or behaviour

Open `supabase/functions/tutor/index.ts`. The model name and the tutor's instructions are near the bottom. Redeploy with `supabase functions deploy tutor --no-verify-jwt`.

## Swapping providers

The app only expects this JSON back: `{ "jp", "kana", "en", "correction": { "said", "better", "why" } | null }`. Any service that returns that shape can replace this function.
