# FinTrack AI — Environment Variables Template

Copy the variables below into a `.env` file at the project root and fill in your actual values.
**Never commit `.env` to version control.**

## Supabase

Found in: **Supabase Dashboard → Project Settings → API**

```
# Your Supabase project URL (e.g. https://xxxxxxxxxxxx.supabase.co)
SUPABASE_URL=

# Supabase anon/public key — safe to use in browser clients
SUPABASE_ANON_KEY=

# Supabase service role key — KEEP SECRET, server-side only
# This key bypasses Row Level Security; never expose to the client
SUPABASE_SERVICE_ROLE_KEY=
```

## OpenAI

Found in: <https://platform.openai.com/api-keys>

```
OPENAI_API_KEY=
```

## Auth & session (self-hosted)

Set `JWT_SECRET` for signing session cookies. OAuth URLs and portal links depend on the provider you configure in `server/_core/oauth.ts`.

```
JWT_SECRET=
# Example placeholders — replace with your OAuth provider:
# OAUTH_SERVER_URL=
# VITE_APP_ID=
# VITE_OAUTH_PORTAL_URL=
OWNER_OPEN_ID=
OWNER_NAME=
```

## Optional: legacy Forge / analytics (only if you still use them)

```
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
```

## Vite Frontend Variables

```
VITE_APP_TITLE=FinTrack AI
VITE_APP_LOGO=
```

## Database

For Supabase: use the connection string from  
**Supabase Dashboard → Project Settings → Database → Connection string → URI**  
(append `?sslmode=require` if not already present)

```
DATABASE_URL=
```
