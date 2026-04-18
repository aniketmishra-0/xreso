# 📊 Xreso Code Review Graph
> Project architecture for AI context - Reference this instead of reading all files!

---

## 🏗️ Project Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Xreso Architecture                     │
│              (Next.js 16 + Turso + Next-Auth 5)             │
└─────────────────────────────────────────────────────────────┘
```

**Stack:** Next.js 16.2.3 | React 19 | TypeScript | Drizzle ORM | Turso (SQLite) | Next-Auth 5

---

## 🗄️ Database Schema Graph

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            Core Tables                                    │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │◄──────│    notes    │──────►│ categories  │
│─────────────│       │─────────────│       │─────────────│
│ id (pk)     │       │ id (pk)     │       │ id (pk)     │
│ name        │       │ title       │       │ name        │
│ email (u)   │       │ description │       │ slug (u)    │
│ password    │◄──────│ author_id   │──────►│ note_count  │
│ role        │       │ category_id │       └─────────────┘
│ premium     │       │ file_url    │
└──────┬──────┘       │ status      │              ┌─────────────┐
       │              │ view_count  │              │    tags     │
       │              │ bookmark_ct │              │─────────────│
       │              └──────┬──────┘              │ id (pk)     │
       │                     │                       │ name (u)    │
       │                     │                       │ slug (u)    │
       │                     │                       └──────┬──────┘
       │                     │                              │
       │                     │         ┌─────────────┐       │
       │                     └────────►│  note_tags  │◄──────┘
       │                               │  (junction) │
       │                               │─────────────│
       │                               │ note_id     │
       │                               │ tag_id      │
       │                               └─────────────┘
       │
       │         ┌─────────────┐       ┌─────────────┐
       └────────►│  bookmarks  │       │    views    │
                 │─────────────│       │─────────────│
                 │ user_id     │       │ note_id     │
                 │ note_id     │       │ user_id     │
                 └─────────────┘       │ ip_hash     │
                                        └─────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                        Premium Module (Advanced Tracks)                    │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ advanced_tracks │────►│advanced_track_  │────►│advanced_track_      │
│                 │     │    topics        │     │   resources         │
│─────────────────│     │──────────────────│     │─────────────────────│
│ id (pk)         │     │ id (pk)          │     │ id (pk)             │
│ slug (u)        │     │ track_id         │     │ track_id            │
│ name            │     │ name             │     │ topic_id            │
│ premium         │     │ level            │     │ author_id           │
│ status          │     └──────────────────┘     │ resource_type       │
└─────────────────┘                               │ content_url         │
                                                  │ premium_only        │
                                                  │ status              │
                                                  └─────────────────────┘
```

---

## 🌐 API Routes Map

```
┌────────────────────────────────────────────────────────────────────────┐
│                           API Structure                                │
│                        /src/app/api/                                    │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  PUBLIC ROUTES (No Auth)                                                │
├─────────────────────────────────────────────────────────────────────────┤
│  GET  /api/health           → Health check                              │
│  GET  /api/categories       → List all categories                     │
│  GET  /api/notes            → Browse/filter notes                     │
│  GET  /api/notes/[id]       → Single note details                     │
│  POST /api/register         → User registration                       │
│  POST /api/password-reset/* → Password reset flow                     │
│  GET  /api/files/[noteId]   → File download (with action=thumb)       │
│  GET  /api/advanced-tracks  → List tracks & topics                    │
│  GET  /api/og               → OpenGraph image generation                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  PROTECTED ROUTES (Auth Required)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  /api/auth/[...nextauth]    → Next-Auth handlers                        │
│                                                                         │
│  UPLOAD & PROFILE:                                                      │
│  POST /api/upload           → File upload (5/hour rate limit)         │
│  POST /api/upload/*         → Multi-part upload sessions              │
│  GET  /api/profile          → User profile                              │
│  PUT  /api/profile          → Update profile                            │
│                                                                 │
│  USER ACTIONS:                                                          │
│  POST /api/bookmarks        → Add bookmark                              │
│  DELETE /api/bookmarks      → Remove bookmark                           │
│  POST /api/notes/[id]/report→ Report note                               │
│                                                                 │
│  ADMIN ROUTES (/api/admin/*):                                           │
│  GET    /api/admin/stats      → Dashboard stats                         │
│  GET    /api/admin/users      → User management                         │
│  GET    /api/admin/notes      → Note moderation                         │
│  PUT    /api/admin/notes      → Approve/reject notes                    │
│  GET    /api/admin/reports    → View reports                            │
│  GET    /api/admin/settings   → Site settings                           │
│  POST   /api/admin/advanced-tracks → Manage tracks                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ Page Structure Graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Page Hierarchy                                │
│                        /src/app/                                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  PUBLIC PAGES                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  /                           → HomePage (page.tsx)                       │
│  ├── Hero + Search                                                      │
│  ├── Featured Categories                                                │
│  └── Popular Notes                                                      │
│                                                                         │
│  /browse                     → BrowsePage (page.tsx)                     │
│  ├── Filter by category                                                 │
│  ├── Grid of notes                                                      │
│  └── Pagination                                                         │
│                                                                         │
│  /categories/[slug]          → CategoryPage (page.tsx)                   │
│  └── Notes in specific category                                         │
│                                                                         │
│  /note/[id]                  → NoteDetailPage (page.tsx)                 │
│  ├── Image viewer (fullscreen support)                                  │
│  ├── Download button                                                    │
│  └── Related notes section                                              │
│                                                                         │
│  /user/[id]                  → PublicProfilePage (page.tsx)                │
│  └── User's public notes                                                │
│                                                                         │
│  /about, /faq, /privacy, /terms, /dmca, /guidelines, /licenses          │
│  └── Static content pages                                               │
│                                                                         │
│  /login, /forgot-password, /reset-password                              │
│  └── Auth pages                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  AUTH REQUIRED PAGES                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  /profile                    → UserProfilePage (page.tsx)                  │
│  ├── My uploads                                                         │
│  ├── My bookmarks (tab)                                                 │
│  └── Settings                                                           │
│                                                                         │
│  /upload                     → UploadPage (page.tsx)                     │
│  ├── File upload (PDF, images)                                        │
│  └── Link share mode                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  ADMIN ONLY PAGES                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  /admin                      → AdminDashboard (page.tsx)                  │
│  ├── Stats & charts                                                     │
│  ├── Pending approvals                                                  │
│  └── User management                                                    │
│                                                                         │
│  /admin/advanced-tracks      → AdvancedTracksAdmin                       │
│  └── Manage premium content                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  ADVANCED TRACKS (Premium Feature)                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  /tracks                     → TracksLandingPage (page.tsx)              │
│  └── Browse all learning tracks                                         │
│                                                                         │
│  /tracks/library            → TracksLibraryPage                         │
│  ├── Filter by track                                                    │
│  └── Search topics                                                      │
│                                                                         │
│  /tracks/categories         → TrackCategoriesPage                       │
│  └── Category browser                                                   │
│                                                                         │
│  /tracks/notes              → TrackNotesPage                            │
│  └── Notes within a track                                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Component Map                                  │
│                     /src/components/                                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  CORE UI COMPONENTS                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Layout:                                                                │
│  ├── Navbar/Navbar.tsx         → Top navigation with auth, theme        │
│  ├── Footer/Footer.tsx         → Site footer                            │
│  ├── ThemeProvider.tsx         → Dark/light theme context               │
│  └── AuthProvider.tsx          → Next-Auth session wrapper              │
│                                                                         │
│  Cards & Lists:                                                         │
│  ├── NoteCard.tsx              → Note preview card                      │
│  ├── CategoryCard.tsx          → Category card with gradient            │
│  ├── NoteGrid.tsx              → Grid layout for notes                  │
│  └── Pagination.tsx            → Page navigation                        │
│                                                                         │
│  Forms:                                                                 │
│  ├── UploadForm.tsx            → File upload with drag-drop             │
│  └── SearchInput.tsx           → Search with debounce                  │
│                                                                         │
│  Advanced Tracks:                                                       │
│  └── TrackCard.tsx             → Learning track card                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  COMPONENT DATA FLOW                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐        │
│  │  Layout  │───►│  Navbar  │───►│   Page   │───►│   Card   │        │
│  │ (Server) │    │(Client)  │    │(Server/  │    │(Client)  │        │
│  └──────────┘    └──────────┘    │ Client)  │    └──────────┘        │
│                                   └────┬─────┘                         │
│                                        │                                │
│                                        ▼                                │
│                                   ┌──────────┐                          │
│                                   │   API    │                          │
│                                   │  Route   │                          │
│                                   └──────────┘                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Layer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Security Architecture                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  AUTHENTICATION (Next-Auth 5)                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Providers:                                                             │
│  ├── Credentials (email/password) → bcrypt hash                         │
│  ├── Google OAuth                                                       │
│  ├── GitHub OAuth                                                       │
│  └── LinkedIn OAuth                                                     │
│                                                                         │
│  Strategy: JWT (session stored in cookie)                               │
│  Role System: user → moderator → admin                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  AUTHORIZATION                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Middleware:                                                            │
│  └── lib/auth.ts → auth() helper checks session                         │
│                                                                         │
│  Route Guards:                                                          │
│  ├── Admin routes: Check session?.user?.role === "admin"                │
│  ├── Premium routes: Check user.premium === true                         │
│  └── Upload: Auth required + rate limiting                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  RATE LIMITING (Upstash Redis + Memory Fallback)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Limits:                                                                │
│  ├── Login: 8 attempts / 15 min / IP                                    │
│  ├── Upload: 5 files / hour / user                                      │
│  ├── Register: 3 accounts / hour / IP                                 │
│  └── API general: 60 requests / min / IP                                │
│                                                                         │
│  Fallback: Memory-based limiting if Redis unavailable                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  SECURITY HEADERS (next.config.ts)                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ├── Content-Security-Policy (CSP)                                      │
│  ├── X-Frame-Options: SAMEORIGIN                                        │
│  ├── X-Content-Type-Options: nosniff                                    │
│  ├── Strict-Transport-Security (HSTS)                                   │
│  └── Referrer-Policy: strict-origin-when-cross-origin                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ File Structure Tree

```
xreso/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # Root layout (Navbar + Footer)
│   │   ├── page.tsx                 # Home page
│   │   ├── globals.css              # Global styles
│   │   │
│   │   ├── api/                     # API Routes
│   │   │   ├── auth/[...nextauth]/  # Next-Auth handlers
│   │   │   ├── notes/               # Notes CRUD
│   │   │   ├── bookmarks/           # Bookmarks API
│   │   │   ├── upload/              # File upload
│   │   │   ├── admin/               # Admin APIs
│   │   │   ├── advanced-tracks/     # Premium tracks API
│   │   │   └── ...
│   │   │
│   │   ├── (pages)/                 # Page routes
│   │   │   ├── browse/
│   │   │   ├── note/[id]/
│   │   │   ├── profile/
│   │   │   ├── upload/
│   │   │   ├── admin/
│   │   │   ├── tracks/
│   │   │   └── ...
│   │   │
│   │   └── [...not_found]/          # 404 page
│   │
│   ├── components/                  # React Components
│   │   ├── Navbar/
│   │   ├── Footer/
│   │   └── ...
│   │
│   ├── lib/                         # Utilities & Config
│   │   ├── db/
│   │   │   ├── schema.ts            # Database schema
│   │   │   └── queries.ts           # Common queries
│   │   ├── auth.ts                  # Next-Auth config
│   │   ├── ratelimit.ts             # Rate limiting
│   │   ├── security-logger.ts       # Secure logging
│   │   ├── validation.ts            # Zod schemas
│   │   └── ...
│   │
│   └── types/
│       └── next-auth.d.ts           # Auth type extensions
│
├── drizzle/                         # DB migrations
├── public/                          # Static assets
├── scripts/                         # Utility scripts
└── config files...                  # next.config.ts, etc.
```

---

## 🔑 Key Implementation Patterns

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Common Patterns                                  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  1. DATA FETCHING                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Server Component (default):                                            │
│  ┌────────────────────────────────────┐                                 │
│  │ async function Page() {          │                                 │
│  │   const notes = await db.query() │                                 │
│  │   return <NoteGrid notes={notes} />│                                │
│  │ }                                 │                                 │
│  └────────────────────────────────────┘                                 │
│                                                                         │
│  Client Component (when needed):                                        │
│  ┌────────────────────────────────────┐                                 │
│  │ "use client"                     │                                 │
│  │ useEffect(() => fetch(), [])       │                                 │
│  └────────────────────────────────────┘                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  2. API ROUTE STRUCTURE                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────┐                                 │
│  │ export async function GET(req) {  │                                 │
│  │   try {                          │                                 │
│  │     const auth = await verifyAuth()│                               │
│  │     if (!auth) return 401        │                                 │
│  │                                  │                                 │
│  │     const data = await db.query()│                                 │
│  │     return Response.json(data)   │                                 │
│  │   } catch {                      │                                 │
│  │     return 500 (generic message) │                                 │
│  │   }                              │                                 │
│  │ }                                 │                                 │
│  └────────────────────────────────────┘                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  3. DATABASE QUERIES (Drizzle)                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────┐                                 │
│  │ const result = await db.execute({│                                 │
│  │   sql: "SELECT * FROM notes      │                                 │
│  │          WHERE status = ?        │                                 │
│  │          LIMIT ?",               │                                 │
│  │   args: ["approved", 10]         │                                 │
│  │ })                                │                                 │
│  └────────────────────────────────────┘                                 │
│                                                                         │
│  Always parameterized - no SQL injection risk                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  4. AUTH CHECK PATTERN                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────┐                                 │
│  │ const session = await auth()     │                                 │
│  │ if (!session?.user?.id) {         │                                 │
│  │   return NextResponse.json(       │                                 │
│  │     { error: "Unauthorized" },     │                                 │
│  │     { status: 401 }              │                                 │
│  │   )                               │                                 │
│  │ }                                 │                                 │
│  └────────────────────────────────────┘                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Stats for AI Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Project Scale                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Files:                                                                 │
│  ├── Pages: ~25 route files                                             │
│  ├── API Routes: ~25 endpoint files                                      │
│  ├── Components: ~15 component files                                    │
│  ├── Lib utilities: ~15 helper files                                   │
│  └── Total TypeScript: ~100 files                                      │
│                                                                         │
│  Database:                                                              │
│  ├── Tables: 10 core + 4 advanced tracks                                 │
│  ├── Relations: users → notes → categories (many-to-many tags)          │
│  └── Junction tables: note_tags, bookmarks, views                        │
│                                                                         │
│  Security:                                                              │
│  ├── Auth: Next-Auth 5 with JWT                                        │
│  ├── Rate limiting: 4 different limiters                                 │
│  └── CSP: Strict policy with frame protection                          │
│                                                                         │
│  Features:                                                              │
│  ├── Core: Browse, upload, bookmark, search                            │
│  ├── Admin: Moderation, analytics, user management                       │
│  └── Premium: Advanced tracks with topic organization                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Quick Reference for AI Prompts

When asking AI to work on xreso, reference this graph:

```
"Update the /api/notes route to add filtering"
↓
→ Look at: API Routes Map → /api/notes section
→ Check: schema.ts → notes table structure  
→ Pattern: Use parameterized queries

"Fix a bug in note display"
↓
→ Look at: Page Structure → /note/[id] page
→ Check: NoteCard component
→ Pattern: Server component with client image viewer

"Add new admin feature"
↓
→ Look at: Admin Pages section
→ Check: auth.ts → role checking pattern
→ Pattern: Admin routes check role === "admin"
```

---

**Last Updated:** Auto-generated from codebase analysis
**File Path:** `/CODE_GRAPH.md`

> 💡 **Tip:** When asking AI to make changes, say: "Use CODE_GRAPH.md as reference" instead of reading all files!
