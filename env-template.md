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

## Dev server (local)

Express serves the app and Vite in development. Default port is **8787** to avoid clashing with common dev ports. Override if needed:

```
PORT=8787
```

If the chosen port is busy, the server picks the next free port — **check the terminal** for the exact `http://localhost:…` URL.

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

## n8n — cập nhật giá vàng/bạc (manual)

Webhook POST từ server khi user bấm **Cập nhật giá** trên trang Đầu tư. Workflow n8n phải **Active** và chỉ dùng Webhook làm trigger (không Schedule).

```
# Bắt buộc: URL Production của node Webhook (ví dụ http://127.0.0.1:5678/webhook/sjc-gold)
N8N_SJC_WEBHOOK_URL=

# Tuỳ chọn: workflow riêng cho bạc (nếu trùng URL trên thì chỉ gọi một lần)
# N8N_SILVER_WEBHOOK_URL=

# Tuỳ chọn: gửi header X-FinTrack-N8n-Secret (cấu hình tương ứng trên n8n)
# N8N_WEBHOOK_SECRET=
```

## Database

For Supabase: use the connection string from  
**Supabase Dashboard → Project Settings → Database → Connection string → URI**  
(append `?sslmode=require` if not already present)

```
DATABASE_URL=
```
