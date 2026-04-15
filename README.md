# xreso

<p align="center">
	<strong>The community-first programmer's library for handwritten, high-signal learning notes.</strong>
</p>

<p align="center">
	<a href="https://github.com/aniketmishra-0/xreso/stargazers">
		<img src="https://img.shields.io/github/stars/aniketmishra-0/xreso?style=social" alt="GitHub Stars" />
	</a>
	<a href="https://github.com/aniketmishra-0/xreso/blob/main/LICENSE">
		<img src="https://img.shields.io/github/license/aniketmishra-0/xreso" alt="License" />
	</a>
	<a href="https://github.com/aniketmishra-0/xreso/issues">
		<img src="https://img.shields.io/github/issues/aniketmishra-0/xreso" alt="Open Issues" />
	</a>
	<img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs" alt="Next.js" />
	<img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
	<img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" />
</p>

## Why xreso exists 🚀

Most quality programming notes stay trapped in private folders and chat threads.

xreso turns those notes into a discoverable, community-powered learning library where developers can:

- share real, practical handwritten resources
- discover curated content fast
- contribute to an open-source education platform that ships quickly

## Why this stack 🧠

We picked this stack to balance speed, reliability, and contributor onboarding:

- **Next.js (App Router) + TypeScript** for modern full-stack DX and maintainable UI/API code.
- **Drizzle ORM + SQLite** for transparent migrations and frictionless local setup.
- **NextAuth v5** for secure auth flows and role-aware access.
- **Modular API routes** for clear ownership and easy feature iteration.

## Local setup in 3 steps ⚡

1. Install dependencies.

```bash
npm install
```

2. Create your environment file.

```bash
cp .env.example .env.local
```

3. Run migrations and start the app.

```bash
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`.

## Self-hosting notes 🛠️

For quick self-hosting, you can run xreso with the local SQLite database.

For production:

- configure your own storage/email providers via environment variables
- run database migrations in your deployment pipeline
- deploy to your preferred platform (Vercel, self-hosted Node, container-based infra)

## Storage routing and Excel workbooks 📚

xreso now keeps submission/audit exports split by responsibility:

- `Community_Links.xlsx`
  - `Community Links`
  - `Registered Users`
  - `User Photos`
- `Advanced_Tracks.xlsx`
  - `Advanced Uploads`
- `Admin_Audit.xlsx`
  - `Admin Logins`
  - `Admin Users`
  - `Admin Actions`

Routing map:

- Community submissions (`/api/upload`) -> `Community_Links.xlsx`
- Advanced track submissions (`/api/admin/advanced-tracks`) -> `Advanced_Tracks.xlsx`
- Admin audit events (logins/moderation actions/admin user sync) -> `Admin_Audit.xlsx`

Database vs Excel responsibility:

- SQLite (`xreso.db`) is the source of truth for app state (notes, users, tracks, moderation status, analytics)
- Excel workbooks are operational exports and audit artifacts used for reporting/routing visibility

Runtime behavior:

- If OneDrive is configured:
  - live workbook writes target OneDrive
  - local files in `data/` are continuously refreshed mirrors
  - if OneDrive is locked/unreachable, writes are queued in `*.pending.xlsx` and background retries continue automatically
- If OneDrive is not configured:
  - workbook writes go directly to local files in `data/`

Useful commands:

```bash
npm run excel:migrate-split # move legacy workbook data into the split workbook setup
npm run verify:storage      # inspect workbook routing and fail on pending/missing live sheets
npm run verify:flows        # verify admin login/community/advanced Excel write paths
npm run verify:all          # run verify:flows + verify:storage
```

Admins can also view the same routing status inside the admin dashboard.

## Upload behavior for large files ⏱️

File uploads now use a two-step flow:

1. The file is saved locally and the DB row is created immediately.
2. If OneDrive is configured, cloud sync continues in the background after the API response.

That means users no longer wait for the full cloud upload before seeing a success state.

Notes:

- browser-to-server upload time still depends on the file size and network speed
- background sync reduces the server-side waiting time, especially for larger PDFs/videos/docs
- if cloud sync fails, the local file stays available as the fallback copy

## Auth setup 🔐

xreso supports email/password auth plus optional social login through Google, GitHub, and LinkedIn.

1. Configure base auth vars in `.env.local` (and in prod env):

- `AUTH_SECRET` (random secret, 32+ chars)
- `NEXTAUTH_URL` (`http://localhost:3000` in local, your real domain in prod)

2. Add provider credentials:

- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
- `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`
- `AUTH_LINKEDIN_ID` and `AUTH_LINKEDIN_SECRET`

3. Add redirect/callback URLs in provider consoles:

- Google console: `http://localhost:3000/api/auth/callback/google`
- GitHub app: `http://localhost:3000/api/auth/callback/github`
- LinkedIn app: `http://localhost:3000/api/auth/callback/linkedin`

For production, replace `http://localhost:3000` with your deployed domain, for example `https://xreso1.vercel.app/api/auth/callback/google`.

4. Restart the dev server after changing env vars.

`AUTH_*` keys are the preferred format. Legacy keys (`GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, `LINKEDIN_CLIENT_ID`) are also accepted for backward compatibility.

### Vercel setup checklist (production)

1. Open Vercel Project → `Settings` → `Environment Variables`.
2. Add these values to `Production`:

- `AUTH_SECRET=<openssl rand -base64 32 output>`
- `NEXTAUTH_URL=https://xreso1.vercel.app`
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`
- `AUTH_LINKEDIN_ID`, `AUTH_LINKEDIN_SECRET`

3. Provider callback URLs:

- Google: `https://xreso1.vercel.app/api/auth/callback/google`
- GitHub: `https://xreso1.vercel.app/api/auth/callback/github`
- LinkedIn: `https://xreso1.vercel.app/api/auth/callback/linkedin`

4. Save env vars and redeploy the latest commit.

## FAQ ❓

The source-of-truth FAQ data lives in `src/lib/faq.ts` for both UI and docs reuse.

### What core problem does xreso solve?

xreso solves fragmentation of learning notes by making community-generated handwritten resources searchable, structured, and reusable.

### Why was this tech stack chosen?

It maximizes contributor productivity while keeping infra simple: fast local setup, predictable migrations, and clean full-stack TypeScript workflows.

### How quickly can developers spin this up?

Most contributors are live in minutes: install dependencies, copy env, migrate DB, run dev server.

## Contributing 🤝

We are building an elite, fast-moving open-source team.

- Start here: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Browse first tasks: [good first issue](https://github.com/aniketmishra-0/xreso/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
- Report bugs or propose features: [GitHub Issues](https://github.com/aniketmishra-0/xreso/issues/new/choose)

## Project scripts 🧩

```bash
npm run dev         # start local development server
npm run build       # production build
npm run lint        # lint codebase
npm run db:generate # create migrations from schema changes
npm run db:migrate  # apply migrations
npm run db:seed     # seed sample data
```

## Community standards 📌

- Keep PRs focused and reviewable.
- Include context and testing notes.
- Prefer clear implementation over clever abstraction.

## License 📄

This project is licensed under the [MIT License](./LICENSE).
