# School Portal

A multi-role school management app: **admins**, **teachers**, **students**, and **parents**, with classes, assignments, assessments, grades & rankings, school news, parent–teacher meetings with RSVP, in-app messaging, and a notification system with per-user preferences and audit logging.

Built with **TanStack Start (React 19 + Vite)**, **Tailwind CSS v4**, **shadcn/ui**, and **Supabase** (Postgres + Auth + Realtime).

---

## Features

- **Auth & roles**: email/password + Google OAuth. Roles stored in a separate `user_roles` table (admin / teacher / student / parent).
- **Admin**: create school-wide announcements & meetings, manage user roles, view notification audit log.
- **Teachers**: create classes (join code), assignments, assessments, enter scores; per-class announcements.
- **Students**: join class by code, view assignments/assessments, submit work, see class rankings.
- **Parents**: link to child by parent code, see all child classes, school news, meetings, assessments, rankings; RSVP to meetings.
- **Notifications**: in-app bell with realtime updates; per-user preferences (announcements / grades / messages); audit log records delivery for every recipient.
- **Realtime**: notifications and meeting RSVP attendee lists update live.

---

## Local development (VS Code)

Requires Node.js 20+ (or [Bun](https://bun.sh)).

```bash
# with npm
npm install
npm run dev

# or with bun
bun install
bun dev
```

The app runs at http://localhost:8080. Create a `.env` file in the project root (copy `.env.example`) with:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...        # anon/publishable key
VITE_SUPABASE_PROJECT_ID=...
# Server-only (used by createServerFn handlers):
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...            # NEVER expose to the browser
```

Useful scripts: `npm run build` (production build), `npm run preview` (serve the build), `npm run lint`.

> **GitHub Pages is not supported.** Pages only serves static files, and this app is a
> server-rendered TanStack Start application with server functions. Use Vercel (below),
> Netlify, or Cloudflare Workers instead.


---

## Deploying to Vercel + standalone Supabase

This project was bootstrapped on Lovable but has **no Lovable-only runtime dependencies in the database or business logic**. To move it off Lovable:

### 1. Create your own Supabase project

1. Create a new project at https://supabase.com.
2. In **Project Settings → API**, copy:
   - Project URL → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon` key → `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only)
3. Apply the schema. The full history lives in `supabase/migrations/`. Either:
   - **Supabase CLI** (recommended):
     ```bash
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
   - **Or** paste each `supabase/migrations/*.sql` file in order into the SQL editor.
4. Enable realtime for the tables the app subscribes to (the migrations already add them to `supabase_realtime`, but verify in **Database → Replication**):
   - `notifications`
   - `messages`
   - `meeting_rsvps`
5. **Auth providers**: in **Authentication → Providers**, enable Email and Google. For Google, add the OAuth client ID/secret and set the redirect URL to `https://<your-vercel-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for dev).

### 2. Remove the Lovable broker for Google sign-in

The current Google sign-in goes through Lovable's OAuth broker (`@/integrations/lovable`). On Vercel + your own Supabase, call Supabase directly. Open `src/routes/auth.tsx` and replace the `lovable.auth.signInWithOAuth("google", …)` call with:

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
```

You can then delete `src/integrations/lovable/` and uninstall `@lovable/*` packages from `package.json`.

### 3. Deploy to Vercel

This is a TanStack Start app on Vite; it deploys to Vercel as a standard Vite + Node/Edge project.

1. Push the repo to GitHub.
2. Import it in Vercel.
3. Framework preset: **Other** (Vercel auto-detects Vite). Build command: `bun run build` (or `npm run build`). Output: `.output/`.
4. Add the env vars listed above in **Project Settings → Environment Variables**. Mark `SUPABASE_SERVICE_ROLE_KEY` as a server-only variable.
5. Deploy.

> Note: the current Vite config targets the Cloudflare Worker runtime (Lovable's default). On Vercel, change `app.config.ts` / `vite.config.ts` target to `"vercel"` (TanStack Start preset) before the first deploy. See https://tanstack.com/start/latest/docs/framework/react/hosting#vercel.

### 4. Files you can delete after migration

- `src/integrations/lovable/` (and any `@lovable/*` deps)
- `.lovable/`, anything starting with `lovable.` in config

What stays unchanged:
- All migrations in `supabase/migrations/`
- `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`
- All routes, components, and server functions

---

## Demo accounts (for your presentation)

Sign up four accounts from `/auth`, choosing a role on signup:

1. **Admin** — create a school announcement and a parent–teacher meeting from `/admin/news`.
2. **Teacher** — create a class from `/teacher`. Note the join code. Create an assessment and an assignment.
3. **Student** — join the class with the code. Submit the assignment.
4. **Parent** — get the student's parent code from their profile, link via `/parent`. View `/news` to see everything.

Then go back to the teacher account and enter a score for the assessment — the student and linked parent will get notifications in real time.

---

## Project structure

```
src/
  routes/                TanStack Start file-based routes
    _authenticated/      gated by Supabase session (auto-redirect to /auth)
  components/            shared UI (incl. NotificationBell, MeetingRsvp)
  integrations/supabase/ auto-generated clients & types (do not edit)
  lib/                   auth context, helpers, server fns
supabase/migrations/     full schema history (apply in order)
```
