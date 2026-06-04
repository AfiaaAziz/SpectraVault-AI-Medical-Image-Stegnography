# Supabase auth for SpectraVault

Users are stored in **Supabase Auth** (`auth.users` in your Postgres database). Passwords are hashed by Supabase (never stored in plain text).

## Setup (one time)

1. Create a project at [supabase.com](https://supabase.com).
2. Get **Project URL** (not on the API Keys page in the new UI):
   - Sidebar: **Project Settings → General** (Reference ID), **or**
   - Sidebar: **Data API** (under Integrations) — URL is shown at the top, **or**
   - Build it: `https://YOUR_PROJECT_REF.supabase.co` (project ref is in the browser URL after `/project/`)
3. Get the **secret** key for the backend:
   - **Project Settings → API Keys** → tab **Legacy anon, service_role API keys** → copy **service_role**, **or**
   - On the main API Keys tab, reveal the **Secret** key (`sb_secret_...`)
3. In the repo root, copy env template and fill values:
   ```powershell
   copy .env.example .env
   ```
4. **Local dev (recommended):** disable email confirmation so login works immediately:
   - **Authentication → Providers → Email**
   - Turn off **Confirm email**
5. Restart the API:
   ```powershell
   .\.venv\Scripts\python.exe run_api.py
   ```

## Where data lives

| Data | Location |
|------|----------|
| Email, password hash | `auth.users` (Supabase managed) |
| Full name | `raw_user_meta_data.full_name` on the user row |
| Session token | Returned to the app; browser stores JWT in `localStorage` |

View users in the dashboard: **Authentication → Users**.

## Security notes

- Never commit `.env` or expose the **service_role** key in the frontend.
- Use **service_role** only on the Python backend.
- For production, keep **Confirm email** enabled and configure SMTP in Supabase.
