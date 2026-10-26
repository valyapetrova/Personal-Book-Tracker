# Shelfie 📚

A small, single-user book tracker. Search over 70,000 free public-domain books from
[Project Gutenberg](https://www.gutenberg.org), put them on your shelves and read them right inside
the app. There is no login: it is a personal app with one local database.

## Features

- **Discover**: search by title or author. With no search, the most popular books are shown.
  Each book shows its cover, title, author and a short description. Results come 20 at a time,
  4 per row on wide screens; **Find more books** adds the next 20 below.
- **Three shelves**: *Want to read*, *Reading* and *Finished*. Add a book to a shelf, move it
  between shelves or remove it, from the search results, the shelf pages or the reader.
- **My shelves**: one tab per shelf, with a live book count.
- **In-app reader**: books are downloaded once from Project Gutenberg and shown as one continuous
  text. Keep scrolling and the next pages load automatically. Prose is re-flowed for any screen
  width, and page numbers are marked in the margin. A sticky bar above the text shows your page
  and progress, lets you jump to any page, and links back to your shelf. When you resume
  mid-book, *Show earlier pages* loads what comes before.
- **Reading progress**: for shelved books, the reader saves the page you are on as you scroll, the
  shelf card shows a progress bar, and *Continue reading* takes you back to where you were. At the
  end of the book you can mark it as finished in one click.
- **Responsive and accessible**: layouts adapt from phones to desktops, support light and dark
  mode, and use semantic HTML, keyboard focus styles and screen-reader labels.

## Tech stack

| Concern  | Choice |
| -------- | ------ |
| Framework | [Next.js 16](https://nextjs.org) (App Router, Server Components, Server Actions, Cache Components) with TypeScript |
| Styling  | Plain CSS: `globals.css` for design tokens and shared utilities, plus a CSS Module per component. No UI library. |
| Database | SQLite through Node's built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html), so there is no native build step |
| Book data | Project Gutenberg's own catalog: the OPDS search feed for search, per-book RDF records for details, plus covers and texts. XML is parsed with [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser). |

## Getting started

Requirements: **Node.js 22.13 or newer** (for `node:sqlite`).

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. The database is created automatically on first use.

| Script | What it does |
| ------ | ------------ |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler |

### Configuration

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `SHELFIE_DB_PATH` | `./data/shelfie.db` | Location of the SQLite database file |

## Project structure

```
src/
├── app/                      Routes (Next.js App Router)
│   ├── page.tsx              Discover: search + results
│   ├── shelves/              My shelves: layout with tabs, one page per shelf
│   ├── read/[id]/            The reader
│   ├── actions.ts            Server Actions: the only way data is changed
│   ├── layout.tsx            Root layout (header, footer, fonts)
│   └── globals.css           Design tokens, element defaults, shared utilities
├── components/               UI components, each with its own CSS Module
│   └── reader/               Reader-specific components
└── lib/                      Framework-independent logic
    ├── db.ts                 SQLite connection, pragmas and migrations
    ├── library.ts            Queries for the user's shelves (books table)
    ├── gutenberg.ts          Project Gutenberg catalog client (cached search, details in SQLite)
    ├── gutenberg-feeds.ts    Pure parsers for the search feed and book records
    ├── book-text.ts          Downloads and caches book texts
    ├── reader.ts             Pure text cleaning and pagination
    ├── shelves.ts            Shelf definitions shared by server and client
    ├── validation.ts         Runtime validation of untrusted input
    └── types.ts              Shared types
```

### How data flows

- **Search**: uses Project Gutenberg's OPDS feed, the same search as gutenberg.org. It answers in
  under a second, ranks results by popularity, and is cached with `"use cache"` for a few hours.
  Titles, authors and covers show immediately.
- **Descriptions**: these come from each book's RDF record and stream into the cards as they arrive.
  At most 4 records are requested at once, to be gentle with Project Gutenberg. Each record is
  stored in SQLite, so it is only ever fetched once.
- **Shelf data**: always read fresh from SQLite for each request.
- **Changing data**: client components call the Server Actions in `src/app/actions.ts` with a book
  id. Every argument is validated at runtime, because a Server Action can be called with any
  payload. Book details are looked up on the server, never taken from the client. The UI updates
  optimistically, and `refresh()` then re-renders the page with the saved state.
- **Book texts**: on first open, a text is downloaded from Project Gutenberg, its licence header and
  footer are stripped, and it is stored in SQLite. Later visits are served locally, even offline.

## Data safety

All data lives in a single SQLite file (`data/shelfie.db`, excluded from git).

- **Crash-safe writes**: WAL journaling with `synchronous = FULL`. A committed change survives a
  crash or power loss, and a half-finished write is never visible.
- **Atomic changes**: every change is a single SQL statement, and SQLite applies each one completely
  or not at all.
- **The database enforces correctness**: `STRICT` tables reject values of the wrong type, and
  `CHECK` constraints reject unknown shelves and invalid ids or page numbers. This holds even if
  application code has a bug.
- **Safe migrations**: schema changes are versioned with `PRAGMA user_version` and applied in one
  transaction, so the schema is never left half-upgraded.
- **No SQL injection**: all queries use bound parameters.
- **Input validation**: Server Actions accept only a validated book id and shelf name. Book details
  are fetched from Project Gutenberg on the server.
- **Confirmed removals**: removing a book (which also deletes its reading progress) needs a
  confirmation click.

**Backups:** stop the app and copy the `data/` folder.

## Notes

- An earlier version used the [Gutendex](https://gutendex.com) API. Gutendex took 15–60 seconds
  (or timed out) for any search that nobody had run recently. Project Gutenberg's own feed answers
  any search in under a second.
- A few catalog entries are audiobooks with no text edition; the reader explains this if you open
  one.
- If Project Gutenberg can't be reached, search and the reader show a **Try again** button.
