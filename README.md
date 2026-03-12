# domain-driver 🚀

A CLI scaffolding tool for domain-driven development in Next.js. Generate feature folder structures instantly — like Laravel's `php artisan make` but for Next.js.

---

## Installation

```bash
npm install -g domain-driver
```

Or use without installing:

```bash
npx domain-driver make:feature <name>
```

---

## Usage

```bash
domain-driver make:feature <feature-name>
```

### Examples

```bash
domain-driver make:feature api-key
domain-driver make:feature user-profile
domain-driver make:feature payment
```

---

## What it generates

Running `domain-driver make:feature api-key` creates the following structure inside your Next.js `app/` directory:

```
app/
└── api-key/
    ├── components/
    │   ├── server/        # React Server Components
    │   └── client/        # Client components ('use client')
    ├── containers/        # Smart components — wire hooks → UI
    ├── hooks/             # Feature-specific hooks (useApiKey, etc.)
    ├── services/          # Business logic and transformations
    ├── repositories/      # Data access layer (fetch/axios calls)
    ├── schemas/           # Zod schemas for forms and API validation
    └── page.tsx           # Next.js page entry point
```

Each folder includes a `.gitkeep` file so empty directories are tracked in Git.

---

## Philosophy

This tool follows a strict **domain-driven** folder structure where everything related to a feature lives together. No more hunting across `/components`, `/hooks`, and `/services` top-level folders.

The layer responsibilities are:

- **repositories** — data fetching only, no business logic
- **services** — business logic, calls repositories
- **hooks** — React state and side effects, calls services
- **containers** — wire hooks into UI, no direct data fetching
- **components** — pure presentational UI, no data dependencies
- **schemas** — Zod validation for both forms and API responses

---

## Requirements

- Node.js 18+
- A Next.js project with an `app/` directory (App Router)

---

## Local Development

```bash
# Clone the repo
git clone https://github.com/yourname/domain-driver
cd domain-driver

# Install dependencies
npm install

# Build
npm run build

# Link globally for local testing
npm link

# Test it
domain-driver make:feature test-feature
```

---

## Roadmap

- [ ] `make:component` — scaffold a single component
- [ ] `make:hook` — scaffold a custom hook
- [ ] `make:service` — scaffold a service
- [ ] Framework detection — auto-adapt structure for Laravel, Go, etc.
- [ ] Interactive mode — prompt for feature name if not provided
- [ ] Config file — customize folder structure per project

---

## License

MIT