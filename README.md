# Personal AI Stylist

Vite + React frontend with Cloudflare Pages Functions for style generation, checkout, and email delivery.

This project now includes Supabase email/password authentication for:

- 회원가입
- 로그인
- Google OAuth 로그인
- 로그아웃
- authenticated API access for checkout, generation, and email delivery

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Copy the example env files.

```bash
cp .env.example .env.local
cp .dev.vars.example .dev.vars
```

3. Start the local Supabase stack with the CLI.

```bash
npm run supabase:start
```

4. Read the local Supabase connection values.

```bash
npm run supabase:status
```

5. Put the `API URL` and key into:

- `.env.local`
- `.dev.vars`

Required variables:

```bash
# .env.local
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...

# .dev.vars
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
GEMINI_API_KEY=...
POLAR_ACCESS_TOKEN=...
POLAR_SERVER=production
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...
RESEND_REPLY_TO=...
```

Notes:

- Hosted Supabase projects: use the `publishable key`.
- Local Supabase CLI / self-hosted stacks: `supabase status` still exposes an `anon key`, so put that value into `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY`, or use the legacy fallback env names.

6. Run the app.

Frontend only:

```bash
npm run dev
```

The Vite dev server is pinned to `http://localhost:5173` so Supabase email redirects do not drift to a fallback port.

Cloudflare Pages + Functions locally:

```bash
npm run cf:dev
```

## Auth Flow

- The browser uses `@supabase/supabase-js` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` by default, with `VITE_SUPABASE_ANON_KEY` as a local fallback.
- The UI now shows a sign-up/sign-in card before users can enter protected flows.
- Email/password sign-up explicitly sets `emailRedirectTo` to the current app origin and pathname, so confirmation emails return to the running frontend instead of relying only on the Supabase project `site_url`.
- Google OAuth uses `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } })`, which fits Supabase's browser-side implicit flow guidance for social login.
- Cloudflare Functions verify the Supabase bearer token through `SUPABASE_URL/auth/v1/user`, using `SUPABASE_PUBLISHABLE_KEY` by default and `SUPABASE_ANON_KEY` as a fallback.
- Checkout creation is tied to the signed-in user email.
- Report email delivery is restricted to the signed-in account email.
- Hosted Supabase projects still need `http://localhost:5173` and/or `http://127.0.0.1:5173` added under Authentication > URL Configuration.

## Google OAuth

- Hosted Supabase projects: enable Google under Authentication > Providers, then add your app origins (for example `http://localhost:5173`) in Google Cloud and keep the same origins in Supabase redirect settings.
- Local Supabase CLI: add `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` to `.env`, then uncomment the Google template in `supabase/config.toml` and replace `client_id` with your Google OAuth client ID.
- Per the Supabase Google auth guide, Google Cloud local development should use `http://127.0.0.1:54321/auth/v1/callback` as the authorized redirect URI. See https://supabase.com/docs/guides/auth/social-login/auth-google

## Supabase Files
- `supabase/config.toml` was created with `supabase init`
- `supabase/seed.sql` is present so the local CLI project is ready for `supabase start`

The local auth config is aligned to Vite defaults:

- `http://127.0.0.1:5173`
- `http://localhost:5173`
- preview URLs on port `4173`

## Useful Commands

```bash
npm run build
npm run lint
npm run supabase:start
npm run supabase:status
npm run supabase:stop
npm run cf:functions:build
```
