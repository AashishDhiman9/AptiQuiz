# AptiQuiz

AptiQuiz is a real-time, multiplayer aptitude-practice platform for students preparing for campus placements. It turns solo practice into timed competition: Hosts create quizzes and rooms, Players join with a room code, and the app tracks answers, scores, and standings. The project addresses **Hackathon Problem Statement 3** by making placement preparation more interactive for students, hosts, and educational communities.

**Built with:** React, TypeScript, TanStack Start, Vite, Supabase Auth/Postgres/Realtime, Drizzle, and Bun.

### What it does

- Hosts can create and edit question sets, request Host access, and run timed quiz rooms after approval.
- Players can join a room by code, answer timed questions, see results, and practise sample questions on their own.
- The server validates answers and deadlines, calculates scores and ranks, and keeps answer keys out of player-facing question data.
- Room and participant updates use Supabase Realtime with polling as a fallback. The app includes leaderboards, college league pages, spectator views, performance summaries, and Host match reports.

These flows are implemented in the codebase. A current server-authentication error still prevents verified end-to-end room creation, and the multiplayer flow has not had an automated integration or load test. See [Done / Left / Plan](#done--left--plan) for the current verification status.

## What it does and the problem statement

**Problem Statement 3:** Placement aptitude preparation is often repetitive and individual. AptiQuiz gives students a shared, timed setting to practise quantitative aptitude, logical reasoning, verbal ability, and data interpretation. Hosts can prepare question sets and facilitate practice rounds; educational communities can use rooms and college standings for friendly competition.

## Done / Left / Plan

### Done in the codebase

- Supabase email/password and Google OAuth entry points, player profiles, and role-based Host requests and approval checks.
- Question-set authoring, room and lobby controls, room-code joins, timed rounds, server-side answer validation, scoring, rankings, results, spectator pages, and Host reports.
- Supabase Realtime room subscriptions with polling fallback, sample solo practice, performance summaries, and college league pages.
- Versioned Drizzle SQL migrations, row-level security policies, and a guarded SQL Editor script for initializing a fresh Supabase project.
- A Node/Nitro production server and a Render Blueprint for full-stack hosting.

### Verified in this workspace

- Frozen-lockfile dependency installation, TypeScript type-check, all 12 unit/route tests, and production build pass.
- The locally started production server returned HTTP 200 for `/`, `/auth`, `/dashboard`, `/host`, `/sets`, `/profile`, `/play`, `/leaderboard`, and `/leagues`; the first five referenced hashed assets also returned HTTP 200 with expected content types. This was an HTTP smoke check, not a browser or responsive-layout test.
- Full ESLint currently fails on 826 Prettier formatting errors and reports 6 React Refresh warnings across the repository. Formatting has not been run across unrelated files.
- Supabase schema access and a Host profile were checked during setup. Room creation still reports an expired or invalid session after sign-in, so authenticated Host actions and complete multiplayer play are not verified end to end.
- No deployed public URL or production deployment has been verified.

### Left / next plan

1. Diagnose the server-side session-token rejection and verify Host room creation with the signed-in account.
2. Configure a Render service and its server environment variables, then add its actual hostname to Supabase Auth redirect allowlists.
3. Test Google OAuth, Player and Host flows, room creation/joining, scoring, Realtime updates, and results against the deployed app.
4. Add Supabase integration and browser end-to-end tests, and load-test before relying on the configured 50-player room limit.
5. Consider an administrator approval screen, reconnection handling, and scheduled room advancement if the product needs them.

## Architecture and why

AptiQuiz is a **full-stack web application**, not a static frontend. TanStack Start server functions perform privileged game operations, while Nitro packages the server for Node.js. A static host such as GitHub Pages cannot run these server functions, so the included deployment target is a Render Node web service.

| Layer                                                  | Responsibility                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| React, TypeScript, TanStack Router/Start, Tailwind CSS | Responsive pages and typed client/server functions.                                                        |
| Supabase Auth                                          | Email/password sessions and Google OAuth when the provider is configured.                                  |
| Supabase Postgres and RLS                              | Profiles, question sets, questions, answer keys, rooms, participants, answers, and Host requests.          |
| Supabase Realtime                                      | Room and participant change notifications; clients also refetch periodically.                              |
| Nitro on Node.js                                       | SSR and server functions for room creation, game state changes, answer validation, scoring, and reporting. |
| Drizzle Kit                                            | Versioned SQL migrations; `DATABASE_URL` is used by migration tooling only.                                |

The browser uses only the Supabase project URL and publishable key. A privileged Supabase secret key is read only by server code. Server functions validate the caller's access token and check the database-backed Host role; the browser's selected role is only a temporary sign-in intent and never grants permission.

## What we added

The current revision includes Host/Player role selection and profile setup, approval-backed Host access, server-side authorization for Host operations, Supabase key handling for the newer publishable/secret key formats, additional database types and migrations, a safe fresh-project SQL Editor script, deployment documentation, and the Render Blueprint. It also adds role-selection tests and documents outstanding production verification.

## How to run

### Requirements

- Node.js 22.12 or newer for the production server.
- Bun 1.4 or newer (the repository is locked with `bun.lock`).
- A Supabase project with Auth and Postgres enabled.

### Local setup

From the repository root:

```powershell
bun.cmd install --frozen-lockfile
Copy-Item .env.example .env
bun.cmd run dev
```

If PowerShell cannot find `bun.cmd`, install Bun and open a new terminal. If Bun is unavailable, Node.js/npm can install dependencies with `npm install` and run the scripts using `npm run`; use the Bun lockfile workflow for deployments and CI.

The Vite development server is available at `http://localhost:3000` by default.

### Environment variables

Copy `.env.example` to `.env` and fill in values from the same Supabase project. The example contains placeholders only. `.env`, `.env.local`, and other `.env.*` files are ignored by Git.

| Variable                        | Used by                | Purpose                                                                                                                                |
| ------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Browser build          | Public Supabase project URL.                                                                                                           |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser build          | Publishable API key; database access is still controlled by RLS.                                                                       |
| `SUPABASE_URL`                  | Server                 | The same Supabase project URL.                                                                                                         |
| `SUPABASE_PUBLISHABLE_KEY`      | Server                 | Public API key used with verified user sessions.                                                                                       |
| `SUPABASE_SECRET_KEY`           | Server only            | Privileged key for trusted game operations. The legacy `SUPABASE_SERVICE_ROLE_KEY` is also accepted. Never prefix either with `VITE_`. |
| `DATABASE_URL`                  | Migration tooling only | PostgreSQL URI used by Drizzle Kit. Keep it private and encode reserved characters in the password.                                    |

Do not put a secret key or database password in browser variables, committed files, or client code. Keep browser and server Supabase URLs and publishable keys pointed at the same project.

### Supabase schema and migrations

The schema lives in `drizzle/schema.ts` and `drizzle/migrations/`. Migrations create the core tables, isolate participant token hashes, add profile roles and Host requests, and apply RLS policies. They do not reset application data.

For an existing project, inspect its schema and migration history before applying pending migrations. Configure `DATABASE_URL` locally, then run:

```powershell
bun.cmd run db:migrate
```

If a fresh project cannot be reached from the local migration runner, `supabase/fresh-project-sql-editor.sql` is a one-time, guarded alternative for the Supabase Dashboard SQL Editor. It aborts when AptiQuiz tables or Drizzle history already exist. Do not run it against a project that already has AptiQuiz data.

The connected Supabase project used during setup has its AptiQuiz tables and Host profile configured. The server-side create-room session error remains open; schema presence alone does not verify authenticated game operations.

### Authentication and Google OAuth

The app sends users back to the current app origin at `/auth` after OAuth. In Supabase **Authentication → URL Configuration**, set the Site URL to the local or deployed app origin and allow the matching `/auth` redirect URL. For local development this is `http://localhost:3000/auth`.

To enable Google sign-in, configure the Google provider in Supabase and place the Supabase callback URL shown in its provider settings in the Google OAuth client's authorized redirect URIs. The Google callback is the Supabase Auth endpoint; the Supabase redirect allowlist contains the AptiQuiz `/auth` URL. Recheck both settings after choosing a deployed hostname. Google login and email confirmation require provider configuration and still need end-to-end verification.

New accounts start as Players. A Player requests Host access; a trusted project administrator reviews the request and approves it in Supabase. There is no in-app administrator console. Never grant Host privileges based only on browser state or a client-supplied role.

### Deploy to Render

The repository includes [`render.yaml`](render.yaml), which defines a Node web service on the free plan in Singapore, builds with Bun, and starts the Nitro production server. Create a Render Blueprint from the connected GitHub repository and select the repository's `render.yaml`. GitHub Pages is not supported for the full application because it cannot run the server functions used for authentication and game operations.

When creating the Blueprint, supply these environment values in Render's dashboard:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only)

Set the browser and server URL/key pairs to the same Supabase project. Do not add `DATABASE_URL` to the web service unless you have a specific migration task; migrations are not run automatically by this service. After Render assigns an actual service URL, add that origin and its `/auth` callback path to Supabase Auth's Site URL and redirect allowlist. The service URL cannot be documented until Render creates it.

Render's free web services sleep after 15 minutes without inbound HTTP requests or WebSocket messages; the first request after sleep can take about a minute to wake the service. This is useful for a demo but can interrupt an event's availability. Review Render's [free service limits](https://render.com/docs/free) before using it for a live competition.

## Testing and commands

```powershell
bun.cmd run dev          # local development
bun.cmd run lint         # ESLint
bun.cmd run typecheck    # TypeScript
bun.cmd run test         # unit and route tests
bun.cmd run build        # production build
bun.cmd run start        # run the production build
bun.cmd run db:migrate   # apply pending Drizzle migrations
```

The current tests cover scoring, route matching, and role-selection logic. They do not exercise Supabase integration, OAuth, database RLS, authenticated room creation, complete multiplayer matches, or load. A successful build does not prove those external services and flows are configured.

The production start script sets `NODE_ENV=production` before loading Nitro, so the server emits the built asset URLs even when run locally without a manually set environment variable. It uses the host-provided `PORT` when present.

## Known limitations

- Host approval is manual in Supabase; there is no admin console.
- Server authentication currently rejects the room-creation request as expired or invalid, even after a fresh sign-in. Diagnose this before treating Host room creation as production-ready.
- Google OAuth, email confirmation redirects, full Player/Host flows, match scoring, leaderboards, and Realtime behavior have not been verified in a live deployment.
- The code configures a maximum of 50 players per room, but that number has not been load-tested.
- Room progression depends on server function calls; idle-room advancement and reconnection recovery are not covered by automated tests.
- Full lint remains blocked by Prettier formatting findings in the existing repository.

## Tools and AI used

- **Application tools:** Bun, Vite, React, TypeScript, TanStack Start/Router, Tailwind CSS, Supabase, Drizzle Kit, Zod, Vitest, and ESLint.
- **Project background:** The project was initially created with Lovable, according to the original project documentation.
- **Development assistance:** Codex assisted with the current repository review, code changes, and documentation.
- AptiQuiz does not call an AI service at runtime.

## Who it is for

- **Students preparing for campus placements** who want timed aptitude practice and friendly competition.
- **Hosts, faculty, and trainers** who create question sets and run practice rounds.
- **Colleges and educational communities** that organize room-based quizzes and college-level standings.

## License

No license file is present. All rights are reserved unless the project owner adds a license.
