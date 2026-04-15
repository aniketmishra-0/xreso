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
