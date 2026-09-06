# Agent guidance, custom actions, and path-form targets

**Date:** 2026-09-06
**Status:** Draft for review
**Scope:** domain-driver 0.2.0 (unreleased), on top of the stack-detection design
**Builds on:** `docs/superpowers/specs/2026-09-06-stack-detection-design.md`

## 1. Goal

Three additions that ship together in 0.2.0:

1. **Path-form targets.** Every layer command takes one `<feature>/<Name>` argument instead of two positional arguments, so `make:schema users/User` reads as "User inside users". `make:feature` accepts an optional `/<Entity>` to name the entity when scaffolding with `-a`.
2. **`make:action`.** A command that scaffolds a bespoke operation, such as `findActiveUsers`, as its own service, repository, and controller files, so nothing outside List, Show, Create, Update, and Delete is ever bolted onto a standard action file.
3. **`init` and a guarded postinstall.** A command that writes agent guidance into the consuming project: marker-delimited sections in `AGENTS.md` and `CLAUDE.md`, and a Claude Code skill at `.claude/skills/domain-driver/SKILL.md`. A postinstall script runs the same logic automatically for local, non-CI installs and never fails an install.

## 2. Non-goals

- Nested features (`billing/invoices`). Every feature is one folder directly under the feature root.
- Inferring the entity name from the feature's `types/` folder.
- Interactive prompts. Every failure is a message and a non-zero exit.
- Editing existing user files to register routes or Nest providers. The tool prints the line to add.
- Guidance files for other agents beyond `AGENTS.md`, which is the cross-agent convention, and the Claude Code skill.
- Backward compatibility with the two-argument command form. 0.2.0 is unreleased; the old form is removed, not deprecated.

## 3. Path-form targets

### 3.1 Grammar

A target is `<feature>/<Name>`:

- Exactly one `/`.
- `<feature>` must satisfy the existing kebab-case rule, `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`.
- `<Name>` must match `^[A-Za-z][A-Za-z0-9]*$`.

`make:feature` takes `<feature>` or `<feature>/<Entity>`. When the entity is omitted it is `toPascalCase(feature)`, as today.

### 3.2 Errors

| Condition | Message |
|---|---|
| Zero or more than one `/` on a layer command | `Target "<value>" must be <feature>/<Name>, for example users/User.` |
| More than one `/` on `make:feature` | `Target "<value>" must be <feature> or <feature>/<Entity>, for example users or users/User.` |
| Bad feature part | the existing `Feature name "<feature>" must be kebab-case, for example coffee-type.` |
| Bad name part | `Name "<name>" must be letters and digits only, for example User.` |

### 3.3 Commands

| Command | Writes |
|---|---|
| `make:feature <feature>[/<Entity>] [-a]` | feature folder; with `-a`, every layer using `<Entity>` |
| `make:types <feature>/<Entity>` | `types/<Entity>.types.ts` |
| `make:schema <feature>/<Entity>` | `schemas/Create<Entity>.schema.ts`, `Update<Entity>.schema.ts` (+ DTOs on Nest) |
| `make:repository <feature>/<Entity> [--side]` | five repositories |
| `make:service <feature>/<Entity> [--side]` | five services |
| `make:controller <feature>/<Entity>` | five controllers, or the Next route handlers |
| `make:action <feature>/<Entity> <actionName> [--with-input] [--returns list\|one\|void]` | see section 4 |
| `make:component <feature>/<Name> [client\|server]` | `components/.../<Name>.tsx` |
| `make:container <feature>/<Name>` | `containers/<Name>.tsx` |
| `make:hook <feature>/<useName>` | `hooks/<useName>.ts` |
| `init` | see section 5 |

Internally the command functions keep their `(feature, name, ...)` signatures. `src/index.ts` parses the target and passes both parts. Only the CLI surface changes.

## 4. `make:action`

### 4.1 Arguments

`make:action <feature>/<Entity> <actionName> [--with-input] [--returns list|one|void]`

- `<actionName>` must match `^[A-Za-z][A-Za-z0-9]*$`. Hyphens, underscores, and spaces are rejected with `Action name "<value>" must be camelCase or PascalCase, for example findActiveUsers.`
- The action name is normalised once and used everywhere:
  - `Action` = PascalCase (`FindActiveUsers`) for file and class names.
  - `action` = camelCase (`findActiveUsers`) for handler function names.
  - `slug` = kebab-case (`find-active-users`) for route paths.
- The action name is used **without** the entity in file and class names. `findActiveUsers` already names what it does. Users are expected to include the noun when it matters (`archiveUser`, not `archive`).
- `--returns` defaults to `list`.
- The feature must exist (the usual error). The entity's types file is not required; when `types/<Entity>.types.ts` is missing the command prints `ℹ️  types/<Entity>.types.ts not found. Run: domain-driver make:types <feature>/<Entity>` and continues.

### 4.2 Shape

| Option | Service and repository `handle` | Controller |
|---|---|---|
| no input, `list` | `handle(): Promise<Entity[]>` | `GET /<slug>`, 200 |
| no input, `one` | `handle(): Promise<Entity>` | `GET /<slug>`, 200 |
| no input, `void` | `handle(): Promise<void>` | `GET /<slug>`, 204 |
| `--with-input`, any | `handle(data: <Action>): Promise<...>` | `POST /<slug>`, body validated with `<Action>Schema`, 200 or 204 |

`--with-input` writes `schemas/<Action>.schema.ts` exporting `<Action>Schema` and the type `<Action>`, and on Nest `dto/<Action>.dto.ts` exporting `<Action>Dto`.

### 4.3 Files per stack

| Stack | Files |
|---|---|
| `node` | `services/<Action>.service.ts`, `repositories/<Action>.repository.ts`, `controllers/<Action>.controller.ts` for the detected framework (generic class when none) |
| `nest` | the same three, `@Injectable()` service and repository, `@Controller('<feature>')` controller with `@Get('<slug>')` or `@Post('<slug>')` |
| `next-fullstack` | `server/services/<Action>.service.ts`, `server/repositories/<Action>.repository.ts`, `client/services/<Action>.service.ts`, `client/repositories/<Action>.repository.ts`, `<featureRoot>/api/<feature>/<slug>/route.ts` |
| `next-frontend`, `react` | `services/<Action>.service.ts`, `repositories/<Action>.repository.ts` (client side) |

The client repository calls `/api/<feature>/<slug>` with GET, or POST with a JSON body when `--with-input`, and returns `response.json()` unless the return kind is `void`. The failure message is `Failed to <action> <Entity>`, for example `Failed to findActiveUsers User`.

### 4.4 Hints after writing

- `node` with a framework: `ℹ️  Add to <feature>.routes.ts: <line>` where the line is the framework's registration, for example `router.get('/find-active-users', findActiveUsersController);` for Express, `app.get('/find-active-users', findActiveUsersController);` for Fastify, `<name>.get('/find-active-users', findActiveUsersController);` for Hono.
- `nest`: the existing `ℹ️  Register <Action>Controller, <Action>Service, <Action>Repository in <feature>.module.ts`.
- `next-fullstack`: none; Next routes by file path.

Existing files are skipped with the standard `⚠️  Skipping "<file>" — already exists`.

### 4.5 One template set, driven by an action spec

Custom actions must not get a second, drifting copy of the controller, service, and repository templates. Instead the existing templates are driven by a frozen `ActionSpec`, and standard actions are just five prebuilt specs:

```ts
interface ActionSpec {
  readonly name: string;            // 'CreateUser' | 'FindActiveUsers': file and class base name
  readonly handler: string;         // 'createUserController' | 'findActiveUsersController'
  readonly params: string;          // '' | 'id: string' | 'data: CreateUser' | 'id: string, data: UpdateUser'
  readonly args: string;            // '' | 'id' | 'data' | 'id, data'
  readonly returns: string;         // 'Promise<User[]>' | 'Promise<User>' | 'Promise<void>'
  readonly usesEntityType: boolean; // import the entity interface
  readonly schema: string | null;   // 'CreateUser' when a schema and DTO back the body, else null
  readonly usesId: boolean;         // controller reads :id from the path
  readonly status: number;          // 200 | 201 | 204
  readonly method: 'get' | 'post' | 'put' | 'delete';
  readonly path: string;            // '/' | '/:id' | '/find-active-users'
  readonly failure: string;         // client repository error text
}
```

- `standardAction(action, entity)` returns the spec for List, Show, Create, Update, Delete with exactly today's values (names `<Action><Entity>`, paths `/` and `/:id`, statuses 200, 200, 201, 200, 204, failure texts unchanged).
- `customAction(entity, actionName, options)` returns the spec described in 4.2.
- `actionSignature`, `controllerShape`, and the per-framework templates are rewritten to read from the spec. Their output for the five standard actions is byte-identical to today, guarded by the existing template and integration tests.
- The Next collection and item route templates stay as they are; a new single-handler route template renders a custom action's `route.ts` from its spec.
- Nest route decorators derive from the spec: method `get` and path `/` give `@Get()`, path `/:id` gives `@Get(':id')`, path `/find-active-users` gives `@Get('find-active-users')`.

## 5. `init`

### 5.1 Behaviour

`domain-driver init` runs from the current directory and writes three things, reporting each as `created`, `updated`, or `unchanged`:

| File | Rule |
|---|---|
| `AGENTS.md` | If the file has both markers, replace everything between them. Else if the file exists, append a blank line and the section. Else create the file with the section. |
| `CLAUDE.md` | Same rule. |
| `.claude/skills/domain-driver/SKILL.md` | Owned by the tool. Written whole; overwritten when content differs. |

The markers are `<!-- domain-driver:start -->` and `<!-- domain-driver:end -->`. Content outside the markers is never touched. Running `init` twice in a row reports `unchanged` for all three and produces no diff.

`init` does not run stack detection and does not print the `Stack:` line. It works in a directory with no `package.json`.

The core is a pure function over strings, `applySection(existing: string | null, section: string): { content: string; status: 'created' | 'updated' | 'unchanged' }`, so the marker logic is testable without a filesystem. `runInit(root: string): readonly InitResult[]` wraps it with file I/O.

### 5.2 Section content for `AGENTS.md` and `CLAUDE.md`

Identical in both files:

```markdown
<!-- domain-driver:start -->
## Scaffolding with domain-driver

This project uses [domain-driver](https://github.com/IsaacHatilima/domain-driver) to scaffold feature folders. Scaffold first, then fill in the generated files. Do not hand-write a layer the tool can generate.

- New feature: `npx domain-driver make:feature <feature>/<Entity> -a`
- One layer in an existing feature: `npx domain-driver make:<layer> <feature>/<Entity>` where layer is types, schema, repository, service, controller, component, container, or hook
- Any operation that is not List, Show, Create, Update, or Delete: `npx domain-driver make:action <feature>/<Entity> <actionName>`. Add `--with-input` when it takes a request body and `--returns one|void` when it does not return a list.

Rules the generated code follows, and that new code must keep:

- One file per action per layer. `findActiveUsers` gets `FindActiveUsers.service.ts`, `FindActiveUsers.repository.ts`, and `FindActiveUsers.controller.ts`. It never goes inside `ShowUser.service.ts` or `ListUser.service.ts`.
- The chain is controller or hook, then service, then repository. Business logic lives in services. Data access lives in repositories. Controllers validate input and call one service.
- Feature folders are kebab-case (`coffee-type`). Entity, action, and class names are PascalCase (`CoffeeType`, `FindActiveUsers`).
- Generated repositories throw until you wire them to your data source. Generated controllers on Node need a line in `<feature>.routes.ts`, and on Nest need registering in `<feature>.module.ts`; the tool prints the exact line.

Full guidance: `.claude/skills/domain-driver/SKILL.md`. Re-run `npx domain-driver init` after upgrading domain-driver to refresh this section.
<!-- domain-driver:end -->
```

### 5.3 `SKILL.md`

```markdown
---
name: domain-driver
description: Scaffold domain-driven feature folders with the domain-driver CLI. Use when creating a feature, adding a layer (types, schema, repository, service, controller, component, container, hook) to an existing feature, or adding any operation beyond List, Show, Create, Update, and Delete.
---

# domain-driver

Every feature lives in one folder, and every action in every layer is one file. Use the CLI to create files; write the logic inside them by hand.

## Detect the stack

The tool reads `package.json` and prints `Stack: <stack> (detected)` before every command. Stacks: `next-fullstack`, `next-frontend`, `react`, `node` (Express, Fastify, Hono, or none), `nest`. Override with `--stack <name>` if detection is wrong.

## Commands

| Task | Command |
|---|---|
| New feature with every layer | `npx domain-driver make:feature users/User -a` |
| New feature, folders only | `npx domain-driver make:feature users` |
| Entity interface | `npx domain-driver make:types users/User` |
| Create and Update schemas (and Nest DTOs) | `npx domain-driver make:schema users/User` |
| Five repositories | `npx domain-driver make:repository users/User` |
| Five services | `npx domain-driver make:service users/User` |
| Five controllers or Next route handlers | `npx domain-driver make:controller users/User` |
| A bespoke operation | `npx domain-driver make:action users/User findActiveUsers` |
| Bespoke operation with a request body | `npx domain-driver make:action users/User archiveUser --with-input --returns one` |
| Component, container, hook | `npx domain-driver make:component users/UserCard`, `make:container users/UserContainer`, `make:hook users/useUser` |
| Refresh this guidance | `npx domain-driver init` |

On `next-fullstack`, `make:service` and `make:repository` take `--side client|server|both` (default both).

## Rules

1. **Scaffold before writing.** If a file the tool can generate does not exist yet, generate it. Do not create `services/FindActiveUsers.service.ts` by hand.
2. **One action, one file, every layer.** A new operation is a `make:action`, never a new method on an existing action class and never a branch inside Show or List.
3. **Keep the chain.** Controller or hook calls one service. Service calls one repository. Repositories do data access only.
4. **Names.** Feature folders kebab-case. Entities, actions, and classes PascalCase. Action names include their noun: `archiveUser`, `findActiveUsers`.
5. **Do not widen the standard five.** List returns all, Show returns one by id, Create takes the create schema, Update takes id and the update schema, Delete takes id. Anything else is a bespoke action.
6. **Finish what the tool leaves open.** Fill the `TODO` in each repository. Add the printed line to `<feature>.routes.ts` on Node or register the printed classes in `<feature>.module.ts` on Nest. Add fields to the Zod schemas.

## Layout by stack

- Next.js: `app/<feature>` or `src/app/<feature>`; route handlers under `app/api/<feature>`.
- React and Node: `src/features/<feature>` or `features/<feature>`.
- Nest: `src/<feature>` with a `<feature>.module.ts`.
```

Both texts live in `src/init/content.ts` as exported string constants so they version with the package.

## 6. Postinstall

### 6.1 Wiring

- `package.json` gains `"postinstall": "node ./scripts/postinstall.js"`.
- `scripts/postinstall.js` is a committed, plain JavaScript file of a few lines that does `require('../dist/postinstall.js').run()` inside a `try`/`catch` that swallows everything. This guarantees an install never fails because `dist/` is absent (a fresh clone of the repo) or because `init` threw.
- `src/postinstall.ts` exports `run(): void` and the pure guard `shouldRunPostinstall(env, readPackageName): PostinstallDecision`.

### 6.2 Guard

`shouldRunPostinstall` returns `{ run: false, reason }` when any of these hold, checked in order:

| Check | Reason |
|---|---|
| `env.CI` is set and not `''`, `'0'`, or `'false'` | `ci` |
| `env.npm_config_global` is `'true'` | `global` |
| `env.INIT_CWD` is unset | `no-init-cwd` |
| `<INIT_CWD>/package.json` is missing or unreadable | `no-consumer-package` |
| that package's `name` is `domain-driver` | `self-install` |

Otherwise it returns `{ run: true, root: env.INIT_CWD }`. `run()` calls the guard, then `runInit(root)` inside a `try`/`catch`, prints one line per file result on success, prints nothing on skip, and never throws or sets a non-zero exit.

## 7. CLI surface changes

- Every layer command's `<feature> <name>` pair becomes one `<target>` argument parsed by `parseTarget`. `make:feature <name>` becomes `<target>` parsed by `parseFeatureTarget`.
- New `make:action <target> <action>` with `--with-input` and `--returns <kind>`. An invalid `--returns` value fails with `Invalid --returns "<value>". Use list, one, or void.`
- New `init`.
- The `preAction` hook skips stack detection and the `Stack:` line for `init`.
- `--help` text and the README document the new forms. Every example in the README uses `<feature>/<Entity>`.

## 8. Code layout

```
scripts/postinstall.js               committed plain JS shim, never fails
src/
  postinstall.ts                     run(), shouldRunPostinstall()
  init/
    markers.ts                       START, END, applySection()
    content.ts                       AGENTS_SECTION, SKILL_CONTENT
    init.ts                          runInit(root), InitResult
  commands/
    target.ts                        parseTarget(), parseFeatureTarget()
    action.ts                        makeAction()
    init.ts                          initCommand() thin wrapper over runInit
  templates/
    actions.ts                       ACTIONS, WRITE_ACTIONS, ActionSpec, standardAction(), customAction(), actionCase helpers
    (existing templates)             rewritten to take an ActionSpec
    controllers/next-action-route.ts single-handler Next route for a custom action
```

`signatures.ts` and `controllers/shape.ts` collapse into the spec: `actionSignature` and `controllerShape` are replaced by fields on `ActionSpec`, and `domainImports`, `schemaImport`, `serviceImport`, `callArgs` read the spec.

## 9. Error handling

All new errors are listed in sections 3.2, 4.1, and 7. Existing errors are unchanged. `init` reports file-system failures through the existing `writeFileSafe` and `mkdirSafe` messages. The postinstall path swallows every error by design and prints nothing on failure.

## 10. Testing

- **Target parsing.** Every row of 3.2 plus the happy paths, including `make:feature` with and without the entity.
- **Action specs.** `standardAction` for all five actions equals the previous `actionSignature` and `controllerShape` values field by field. `customAction` for each combination of input and return kind. Case helpers: `findActiveUsers`, `FindActiveUsers`, `find-active-users`.
- **Template regression.** Every existing template test passes unchanged after the spec refactor. The existing per-stack integration file trees and import walks pass unchanged.
- **Custom action templates.** Per framework: method, path, status, body validation only with input, `Promise<void>` with 204, Nest decorator derived from the spec, Next single-handler route, client repository URL and method.
- **`make:action` integration.** In each stack fixture, `make:feature coffee-type/CoffeeType -a` then `make:action coffee-type/CoffeeType findActiveUsers` and once more with `--with-input --returns one`; assert the exact new files, that every generated import resolves, and the hint lines.
- **`init`.** `applySection` on null, on content without markers, on content with markers and different section, on content with markers and identical section; surrounding content preserved byte for byte. `runInit` in a temp dir: creates all three; second run reports unchanged and leaves no diff; a hand-edited `AGENTS.md` keeps its edits outside the markers.
- **Postinstall guard.** One case per reason in 6.2 and the run case, with a fake env and a fake package reader. `run()` with a throwing `runInit` does not throw.
- **CLI smoke test.** The built binary: a layer command with a bad target, `make:action` on a Node fixture, `init` twice showing `unchanged`, and `npm install` of a packed tarball into a scratch project (with and without `CI=1`) showing the files appear only without `CI`.

Coverage stays above the 80 percent thresholds.

## 11. README

The README's command sections switch to the target form, add `make:action` with its options and per-stack file table, add an "Agent guidance" section describing `init`, the three files, the markers, the postinstall behaviour and its guards, and how to opt out (`npm install --ignore-scripts`, or delete the section).
