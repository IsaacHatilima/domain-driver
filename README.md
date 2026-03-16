# domain-driver 🚀

A CLI scaffolding tool for domain-driven development in Next.js. Generate feature folder structures instantly — like Laravel's `php artisan make` but for Next.js.

---

## Installation

```bash
npm install -g domain-driver
```

Or use without installing:

```bash
npx domain-driver make:feature <n>
```

---

## Commands

### `make:feature`

Scaffold a full feature folder structure.

```bash
domain-driver make:feature <n>
domain-driver make:feature <n> -a
```

The `-a` flag scaffolds all files inside each folder automatically.

```bash
domain-driver make:feature coffee-type        # folders + .gitkeep only
domain-driver make:feature coffee-type  -a    # folders + all files
```

---

### `make:component`

Scaffold a component inside an existing feature. Defaults to `client` if no type is specified.

```bash
domain-driver make:component <feature> <n>
domain-driver make:component <feature> <n> client
domain-driver make:component <feature> <n> server
```

```bash
domain-driver make:component coffee-type CoffeeTypeList
domain-driver make:component coffee-type CoffeeTypeForm client
domain-driver make:component coffee-type CoffeeTypeCard server
```

---

### `make:container`

Scaffold a smart container component inside an existing feature.

```bash
domain-driver make:container <feature> <n>
```

```bash
domain-driver make:container coffee-type CoffeeTypeContainer
```

---

### `make:hook`

Scaffold a custom hook inside an existing feature.

```bash
domain-driver make:hook <feature> <n>
```

```bash
domain-driver make:hook coffee-type useCoffeeType
```

---

### `make:service`

Scaffold a set of single-responsibility service files inside an existing feature.

```bash
domain-driver make:service <feature> <n>
```

```bash
domain-driver make:service coffee-type CoffeeType
```

Generates:

```
app/coffee-type/services/
├── ListCoffeeType.service.ts
├── ShowCoffeeType.service.ts
├── CreateCoffeeType.service.ts
├── UpdateCoffeeType.service.ts
└── DeleteCoffeeType.service.ts
```

---

### `make:repository`

Scaffold a set of single-responsibility repository files inside an existing feature.

```bash
domain-driver make:repository <feature> <n>
```

```bash
domain-driver make:repository coffee-type CoffeeType
```

Generates:

```
app/coffee-type/repositories/
├── ListCoffeeType.repository.ts
├── ShowCoffeeType.repository.ts
├── CreateCoffeeType.repository.ts
├── UpdateCoffeeType.repository.ts
└── DeleteCoffeeType.repository.ts
```

---

### `make:schema`

Scaffold Zod schemas for create and update operations inside an existing feature.

```bash
domain-driver make:schema <feature> <n>
```

```bash
domain-driver make:schema coffee-type CoffeeType
```

Generates:

```
app/coffee-type/schemas/
├── CreateCoffeeType.schema.ts
└── UpdateCoffeeType.schema.ts
```

---

## What `make:feature -a` generates

Running `domain-driver make:feature coffee-type -a` creates the full structure:

```
app/
└── coffee-type/
    ├── components/
    │   ├── server/
    │   └── client/
    │       └── CoffeeType.tsx
    ├── containers/
    │   └── CoffeeTypeContainer.tsx
    ├── hooks/
    │   └── useCoffeeType.ts
    ├── services/
    │   ├── ListCoffeeType.service.ts
    │   ├── ShowCoffeeType.service.ts
    │   ├── CreateCoffeeType.service.ts
    │   ├── UpdateCoffeeType.service.ts
    │   └── DeleteCoffeeType.service.ts
    ├── repositories/
    │   ├── ListCoffeeType.repository.ts
    │   ├── ShowCoffeeType.repository.ts
    │   ├── CreateCoffeeType.repository.ts
    │   ├── UpdateCoffeeType.repository.ts
    │   └── DeleteCoffeeType.repository.ts
    ├── schemas/
    │   ├── CreateCoffeeType.schema.ts
    │   └── UpdateCoffeeType.schema.ts
    └── page.tsx
```

---

## Philosophy

This tool follows a strict **domain-driven** folder structure where everything related to a feature lives together. No more hunting across `/components`, `/hooks`, and `/services` top-level folders.

The layer responsibilities are:

- **repositories** — data fetching only, no business logic
- **services** — business logic, calls repositories
- **hooks** — React state and side effects, calls services
- **containers** — wire hooks into UI, no direct data fetching
- **components** — pure presentational UI, no data dependencies
- **schemas** — Zod validation for create and update operations

---

## Requirements

- Node.js 18+

---

## Framework Support

This tool is optimised for **Next.js App Router** projects. All files are scaffolded into the `app/` directory following Next.js conventions (`page.tsx`, server/client component separation, etc.).

If no `app/` directory exists, it will be created automatically. This means the tool can also be used in any project where an `app/<feature>` folder structure makes sense.

## Local Development

```bash
# Clone the repo
git clone https://github.com/IsaacHatilima/domain-driver
cd domain-driver

# Install dependencies
npm install

# Build
npm run build

# Link globally for local testing
npm link

# Test it
domain-driver make:feature test-feature
domain-driver make:feature test-feature -a
```

---

## Roadmap

- [x] `make:feature` — scaffold feature folder structure
- [x] `make:feature -a` — scaffold feature with all files
- [x] `make:component` — scaffold a component
- [x] `make:container` — scaffold a container
- [x] `make:hook` — scaffold a custom hook
- [x] `make:service` — scaffold single-responsibility services
- [x] `make:repository` — scaffold single-responsibility repositories
- [x] `make:schema` — scaffold Zod schemas
- [ ] Interactive mode — prompt for name if not provided
- [ ] Config file — customize folder structure per project

---

## License

MIT