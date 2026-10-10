# AptiQuiz

**Think Fast. Play Smart. Rise to the Top.**

AptiQuiz is a real-time aptitude quiz platform built for **Hackathon Problem Statement 3**. It gives college students a competitive way to practise placement aptitude and gives hosts a place to author question sets, run live rounds, and review match results.

## Table of contents

- [What it does](#what-it-does)
- [Features](#features)
- [Screenshots](#screenshots)
- [Done / Left / Plan](#done--left--plan)
- [Architecture and why](#architecture-and-why)
- [What we added](#what-we-added)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and local setup](#installation-and-local-setup)
- [Environment variables](#environment-variables)
- [How to play](#how-to-play)
- [Scoring system](#scoring-system)
- [Real-time architecture and fairness](#real-time-architecture-and-fairness)
- [Testing](#testing)
- [Security and privacy](#security-and-privacy)
- [Deployment](#deployment)
- [Tools and AI used](#tools-and-ai-used)
- [Who it is for](#who-it-is-for)
- [Roadmap and known limitations](#roadmap-and-known-limitations)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## What it does

AptiQuiz addresses **Problem Statement 3** with a platform for timed, multiplayer aptitude competitions. Hosts create question sets and rooms; players join with a room code, answer timed questions, and see scores and standings update during the match. Signed-in users can also practise sample questions and review their performance.

## Features

### Implemented in the codebase

- Email and password registration/sign-in, plus Google sign-in through Supabase when the provider is configured.
- Question-set creation and editing, including question text, options, topic, difficulty, time limit, explanation, and answer key.
- Room creation, a waiting lobby, room-code joining, and host controls to start, advance, end, or remove players from a lobby.
- Timed rounds across quantitative aptitude, logical reasoning, verbal ability, and data interpretation.
- Server-side answer checking, per-player option order, score updates, and ranked standings.
- Live room updates through Supabase Realtime, with a four-second polling fallback.
- Match results, a spectator display, a sample solo-practice flow, individual performance analytics, and college league pages.
- Per-question host reports with response counts, accuracy, and average answer time.

### Configured or present, but not load-tested

- Rooms are configured for a maximum of 50 players. The repository has no multiplayer integration test or 50-player load test, so capacity and behavior under concurrent joins have not been established.
- Supabase is required for authentication, persistence, and real-time updates. Google sign-in also requires a Google provider configured in the Supabase project.

## Screenshots

No product screenshots are included yet. Add genuine captures to [`docs/screenshots/`](docs/screenshots/) and link them here when they are available. See the folder's README for suggested screens and capture guidance.

## Done / Left / Plan

### Done in the current implementation

- File-based pages for the dashboard, question sets, host lobby and match, player join/play, spectator mode, practice, leaderboard, college leagues, profile, and performance.
- Supabase-backed authentication and data access, SQL migrations, room state transitions, answer submission, scoring, and standings.
- A sample question set and clearly labelled demo match seeded by the initial database migration.
- Unit coverage for scoring rules and a route-matching smoke test. See [Testing](#testing) for the checks run for this repository revision.

### Left or not verified

- End-to-end play with a configured Supabase project and Google OAuth provider has not been verified as part of this repository cleanup.
- Reconnection, high concurrency, fairness under unusual network conditions, and 50-player capacity do not have integration or load-test coverage.
- Phase advancement is requested by connected clients when their displayed timer expires; there is no independent scheduled worker that advances idle rooms.
- The product has no battle replay, faculty role/reporting area, or dedicated automated multiplayer/load-test suite.

### Plan

1. Configure a non-production Supabase project and verify sign-up, Google OAuth, question authoring, a full match, results, and reconnect behavior end to end.
2. Add server-function integration tests for room access, duplicate/late answers, deadlines, answer-key access, and concurrent submissions.
3. Add a repeatable load test before making claims about the configured 50-player room limit.
4. Decide whether rooms need scheduled server-side advancement when every player disconnects.
5. Capture real screenshots and attach them under `docs/screenshots/`.

## Architecture and why

- **Application:** React 19 and TypeScript on [TanStack Start](https://tanstack.com/start) and TanStack Router. File-based routing keeps the host, player, spectator, and analytics pages in one full-stack application.
- **Build and styling:** Vite, Tailwind CSS 4, Radix UI primitives, and reusable components in `src/components/`.
- **Data, auth, and realtime:** [Supabase](https://supabase.com/docs) Auth and Postgres are used for accounts and application data. Supabase Realtime Postgres-change subscriptions refresh room and participant state. There is no Socket.IO service.
- **Server functions:** TanStack Start server functions validate inputs and run game actions. The server uses a Supabase service-role client for operations that must bypass ordinary row-level access, including checking answer keys and recording scores. The service-role key must stay on the server.
- **Database:** PostgreSQL tables, row-level security policies, indexes, triggers, seed data, and migrations are in `drizzle/`. `drizzle/schema.ts` describes the schema for [Drizzle Kit](https://orm.drizzle.team/docs/overview).
- **Game state:** A room row stores its phase, current question, and phase timestamps. Server functions advance the state machine when called; clients display the deadline and request a sync at expiry.
- **Scoring:** The server records the accepted answer time, compares the selected option with the private answer key, and writes the score and participant totals. See [Scoring system](#scoring-system).
- **Deployment:** The Vite/TanStack Start build produces a Node.js server output. Supabase remains an external managed service; this repository does not include a separate API server or Socket.IO backend.

## What we added

Beyond live question rounds, the implementation includes an individual performance page that summarizes recorded answers by topic and difficulty, a college league based on each college's top five individual match scores, and a spectator layout for a shared display. Hosts can inspect per-question response and timing summaries after a match. These features are backed by the application's current Supabase data model; they are not AI-generated at runtime.

## Project structure

```text
.
├── docs/screenshots/          # Instructions for adding real product screenshots
├── drizzle/
│   ├── migrations/            # PostgreSQL/Supabase schema and seed migrations
│   └── schema.ts              # Drizzle schema
├── public/                    # Static public assets
├── src/
│   ├── components/            # App shell, leaderboard, timer, and UI primitives
│   ├── hooks/                 # Auth and live-room hooks
│   ├── integrations/supabase/ # Browser/server Supabase clients and auth middleware
│   ├── lib/                   # Game server functions, scoring, stats, and utilities
│   ├── routes/                # TanStack file-based pages
│   ├── test/                  # Shared test setup and route test
│   ├── router.tsx             # Router construction
│   ├── server.ts              # Server entry and error response handling
│   └── start.ts               # TanStack Start middleware setup
├── supabase/config.toml       # Supabase CLI project configuration
├── .env.example               # Environment-variable template
├── bun.lock                   # Bun dependency lockfile
├── drizzle.config.ts          # Drizzle Kit configuration
└── vite.config.ts             # Vite and TanStack Start plugins
```

## Prerequisites

- Node.js **22.12 or newer** for the TanStack Start toolchain.
- Bun, because this repository uses `bun.lock`.
- A Supabase project with Postgres, Auth, and Realtime enabled for connected application flows.
- A direct PostgreSQL connection string for applying Drizzle migrations.
- A Google OAuth provider in Supabase if Google sign-in is required. Email/password sign-in can be used without Google OAuth.

## Installation and local setup

1. Clone the repository and enter the project directory:

   ```sh
   git clone https://github.com/AashishDhiman9/AptiQuiz.git
   cd AptiQuiz
   ```

2. Install the locked dependencies:

   ```sh
   bun install --frozen-lockfile
   ```

3. Create a local environment file. In PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   On macOS or Linux, use `cp .env.example .env`.

4. Fill in the Supabase values in `.env`. Keep the service-role key and database connection string server-side; never add a `VITE_` prefix to either one.

5. Apply the migrations to the configured Supabase database:

   ```sh
   bun run db:migrate
   ```

6. Start the development server:

   ```sh
   bun run dev
   ```

   Vite prints the local URL when the server is ready. Supabase-dependent pages and game actions need valid credentials and a database with the migrations applied.

Other useful commands:

```sh
bun run lint
bun run typecheck
bun run test
bun run build
```

## Environment variables

Copy [`.env.example`](.env.example) to `.env`. The example contains placeholders only.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser build | Supabase project URL exposed to the browser. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser build | Supabase publishable key; it is public client configuration and must be protected by database policies. |
| `SUPABASE_URL` | Server | Supabase project URL for server functions and server-side client setup. |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Public Supabase key used by server-side auth validation and the server client. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged key used by game operations that bypass row-level security. Never expose it in browser code or commit it. |
| `DATABASE_URL` | Migration tooling only | PostgreSQL connection string used by Drizzle Kit. Treat it as a secret. |

The browser values are public by design. The service-role key and `DATABASE_URL` are private server configuration. Do not commit `.env`.

## How to play

1. A host signs in, creates a question set, adds questions and answer keys, and publishes the set.
2. The host creates a room from that set. The room starts in a lobby and has a shareable code.
3. Players open **Play**, enter the room code and a display name, and can optionally choose a college. An account is optional for joining; sign-in is needed to save results to personal history.
4. The host starts the match after at least one player joins. A five-second countdown precedes the first question.
5. Players answer each question before its configured deadline. Choices are shuffled per player. The correct answer and explanation appear in the reveal phase.
6. A reveal normally lasts seven seconds, then the next question starts. If all players have answered, the server may reveal early. The host can also advance or end the match.
7. Scores and standings update during play. At the end, the host can view the results and question summary; the room can also be opened in spectator mode.

The sample set can be used for solo, untimed practice. Practice answers do not affect match rankings.

## Scoring system

For a correct answer, the game awards **1,000 base points plus a speed bonus of up to 500**:

```text
speed bonus = floor(500 × max(0, 1 − elapsed time / question duration))
correct answer = 1,000 + speed bonus
incorrect answer = 0
```

Elapsed time is clamped to the question duration. A correct answer received at or after the deadline but within the 400 ms network grace window receives the base 1,000 points and no speed bonus. Answers beyond that grace window are rejected. A database uniqueness constraint allows one recorded answer per player per question; repeated submissions are rejected. Unanswered questions add no score.

Standings break ties by total score (descending), number of correct answers (descending), aggregate accepted answer time (ascending), then participant ID for a stable final order. Accuracy excludes unanswered questions.

## Real-time architecture and fairness

Room and participant rows are watched through Supabase Realtime. A four-second refetch interval is also used as a fallback if a change event is missed. The browser estimates its clock offset from a server response to render the countdown; the server checks answer receipt time against the stored phase deadline and applies the 400 ms grace period.

Answer keys are read by server functions and are not included in the active question payload. The server decides correctness, accepted elapsed time, and points. The room limit is configured as 50, but concurrent joins, network-delay fairness, reconnect behavior, and that player count have not been established by automated integration or load tests. Phase changes are client-triggered at expiry, so an idle room may wait for a client to request synchronization.

## Testing

The repository provides these commands:

| Check | Command | Coverage |
| --- | --- | --- |
| Lint | `bun run lint` | ESLint over the repository. |
| TypeScript | `bun run typecheck` | `tsc --noEmit` using `tsconfig.json`. |
| Unit and route tests | `bun run test` | Vitest tests under `src/`, including scoring rules and a route-matching smoke test. |
| Production build | `bun run build` | Vite/TanStack Start production build. |

There is no multiplayer integration test or 50-player load-test script in the repository.

### Observed results for this revision

- `bun install --frozen-lockfile --dry-run` — passed.
- `bun run lint` — exits with errors: the repo-wide run reports 793 `prettier/prettier` errors and 6 `react-refresh/only-export-components` warnings. ESLint on the files changed in this cleanup passes.
- `bun run typecheck` — passed.
- `bun run test` — passed: 2 test files and 8 tests.
- `bun run build` — passed and generated the Nitro Node server at `.output/server/index.mjs`.
- Production HTTP smoke check — 13 application URLs returned HTTP 200 from `bun run start`. This checks route responses; it does not exercise OAuth or a complete database-backed match.

## Security and privacy

- `.env` and environment-specific files are ignored by Git; `.env.example` contains placeholders.
- The service-role key is used only by server-side code. Keep it and the database connection string out of client bundles, logs, and commits.
- Server functions validate input with Zod. Host actions require a verified Supabase user and check that user owns the room; database row-level policies protect user profiles and question sets.
- Correct-answer keys are stored separately from player-visible question options. Server functions compute correctness and score.
- Players may join without an account. Display names, college selections, scores, and room state are visible to other participants through the public room/leaderboard queries. Do not enter sensitive personal information as a display name.
- The current project has no rate limiting or load/security test suite for public room-join and answer endpoints. The configured room cap should not be treated as a verified capacity guarantee.

## Deployment

Build and run the TanStack Start server on a Node.js host:

```sh
bun install --frozen-lockfile
bun run build
bun run start
```

The host must provide Node.js 22.12 or newer and the server environment variables from [`.env.example`](.env.example). Configure Supabase Auth's site URL and redirect allow-list for the deployed origin, and add the same callback origin to the Google OAuth configuration when using Google sign-in. Apply the database migrations before serving traffic. Supabase Realtime is a managed external dependency; the application does not require a separately hosted Socket.IO server.

No verified live deployment URL is available in this repository.

## Tools and AI used

- **Lovable:** The project was initially created with Lovable, as described in the project brief. Lovable is not used at runtime after this cleanup.
- **Codex:** Used for this repository review, cleanup, and documentation update.
- **GitHub Copilot:** Intended as an editor coding assistant for future local development; it is not an application dependency or runtime service.
- **Application stack:** Bun, Vite, React, TypeScript, TanStack Start/Router, Tailwind CSS, Radix UI, Supabase, Drizzle, Zod, Vitest, and Lucide icons.
- **Runtime AI:** AptiQuiz does not call an AI model or AI service at runtime.

## Who it is for

- **College students preparing for placements** can practise aptitude questions, join live contests, and review topic-level performance.
- **Faculty and trainers** can author question sets and host timed practice sessions. The current app does not include a separate faculty role or institutional administration console.
- **Colleges running competitions** can use room codes, spectator screens, and college league standings to organize events. These flows still need real-world and load testing before large events.

## Roadmap and known limitations

- Add end-to-end tests for authentication, host/player flows, deadlines, duplicate submissions, and reconnection.
- Load-test before claiming reliable 50-player rooms; the configured limit alone does not prove capacity.
- Consider scheduled server-side room advancement for matches with no connected clients.
- Add a replay/history experience and faculty-focused reporting if they are needed by users.
- Add genuine product screenshots and verify a production deployment.
- Google OAuth, external Supabase credentials, database policies, and production operations must be configured outside this repository.

## Contributing

1. Open an issue describing the problem or proposed change.
2. Create a focused branch and keep changes small enough to review.
3. Install dependencies with `bun install`, then run lint, typecheck, tests, and build for changes that affect the application.
4. Include or update tests when changing scoring, authorization, room transitions, or data access.
5. Open a pull request with a summary, verification results, and screenshots for visible UI changes where relevant.

Do not include `.env`, credentials, user data, or production database dumps in issues or pull requests.

## License

No license file is present. All rights are reserved unless the project owner adds and selects a license.

## Acknowledgments

Thanks to the maintainers of React, TanStack, Vite, Tailwind CSS, Radix UI, Supabase, Drizzle, Bun, Vitest, Zod, and Lucide for the libraries used by this project. The sample database migration includes demonstration questions and clearly labelled demo match data.
