# Contributing to xreso 🚀

Welcome to xreso. We are building a fast, community-owned library for handwritten programming knowledge.

If you like shipping clean code, solving real user problems, and collaborating in the open, you are in the right place.

## Why Contribute to Us? 🌟

- Real impact: your work improves how developers learn every day.
- Modern stack: Next.js 16, TypeScript, Drizzle, NextAuth.
- Fast feedback loops: maintainers actively review, discuss, and merge.
- Public portfolio value: meaningful OSS work, visible to everyone.
- Product ownership: contributors can influence roadmap direction.

## Local Setup in 3 Steps ⚡

### 1) Install dependencies

```bash
npm install
```

### 2) Configure local environment

```bash
cp .env.example .env.local
```

Update `.env.local` with the required values.

### 3) Initialize database and run dev server

```bash
npm run db:migrate
npm run dev
```

App runs at `http://localhost:3000`.

## Find Your First Issue 🧭

- Start here: [good first issues](https://github.com/aniketmishra-0/xreso/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22)
- Want a challenge: [help wanted](https://github.com/aniketmishra-0/xreso/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22)
- Found a bug: [open an issue](https://github.com/aniketmishra-0/xreso/issues/new/choose)

When you pick an issue, leave a quick comment like: "I can take this" so work stays coordinated.

## Contribution Workflow ✅

1. Fork the repository and create a feature branch from `main`.
2. Keep changes scoped to one feature/fix per pull request.
3. Write clear commit messages.
4. Run checks before opening a PR.
5. Open a pull request with context, screenshots (if UI), and test notes.

## Quality Bar 🧪

Run these before you open a PR:

```bash
npm run lint
npm run build
```

Engineering expectations:

- Keep TypeScript strict and explicit.
- Avoid unrelated refactors in focused PRs.
- Preserve accessibility in UI changes.
- Add or update docs when behavior changes.

## Pull Request Checklist 📋

- [ ] Linked related issue (or explained why none exists)
- [ ] Lint/build pass locally
- [ ] UI changes include screenshot or short demo
- [ ] New env vars are documented
- [ ] README/CONTRIBUTING updated if needed

## Communication Rules 🤝

- Be kind, direct, and constructive.
- Assume positive intent.
- Prefer actionable feedback over vague comments.
- Keep discussions in issues/PRs so context is preserved.

## Need Help?

- Ask in [GitHub Issues](https://github.com/aniketmishra-0/xreso/issues)
- Mention blockers early
- Propose options when asking for direction

Thanks for building xreso with us. Let us ship excellent work together. 🔥