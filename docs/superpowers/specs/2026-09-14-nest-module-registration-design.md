# Automatic NestJS module registration — design

**Date:** 2026-09-14
**Status:** awaiting review

## Goal

Register generated NestJS code in the module files that have to know about it: the feature module in `app.module.ts`, and generated controllers, services and repositories in `<feature>.module.ts`.

## Why this is different from everything else the tool does

Every write today goes through `writeIfAbsent`, which creates a file or warns and skips. domain-driver has never modified a file it did not create, and the README states that as a guarantee. This feature breaks that invariant, in the file that boots the user's application.

That asymmetry drives every decision below. A bug that writes a wrong new file costs a deletion. A bug that corrupts `app.module.ts` costs a broken build in a file the user did not ask us to touch.

## Scope

In scope:

- `make:feature` on `nest` registers `<Entity>Module` in the root module
- `make:controller`, `make:service`, `make:repository` and `make:action` on `nest` register the classes they generate in `<feature>.module.ts`
- An off switch restoring today's write-only behaviour
- A bail path that changes nothing and prints paste-ready lines

Out of scope, with reasons:

- Any stack other than `nest`. Next and TanStack Start have file-based routing with nothing to register; `node` has a routes file that already gets a printed hint with the exact line.
- Removing registrations. Deleting a feature is not something the tool does, so unregistering has no caller.
- Reordering or reformatting anything. The tool inserts; it never rewrites what is already there.

## How the edit is made

### Parsing

Use the TypeScript compiler API via the **consuming project's own** `typescript`, resolved with `require.resolve('typescript', { paths: [cwd] })`. Every TypeScript Nest project has it — it cannot compile without one — so this adds no runtime dependency to a CLI that is otherwise dependency-light. If resolution fails, that is a bail, not an error.

### Editing

Parse to an AST to find positions, then apply a **text-range edit to the original source**. Never re-emit the AST. Re-emitting would reformat the whole file and discard comments, and a real `app.module.ts` carries comments that hold intent:

```ts
imports: [
  // Global infrastructure first: each of these registers itself with @Global().
  AppConfigModule,
  ...
  // Guards run in registration order: rate limit first, then authenticate.
```

Two insertions per registration:

1. **The import.** Insert a new `import` statement immediately after the last existing import declaration, at that node's end. Never sorted into place — import order in these files is frequently hand-arranged.
2. **The array entry.** Locate the `@Module({ ... })` decorator's object literal, then the named property (`imports`, `controllers` or `providers`), then its array literal. Insert after the last element, matching the indentation of that element. An empty array becomes a populated multi-line one.

Positions come from the AST, so a nested array inside a call expression cannot be mistaken for the target. This is the specific hazard that rules out string scanning: a real root module contains

```ts
ThrottlerModule.forRootAsync({
  useFactory: (env: Env) => ({
    throttlers: [{ ttl: env.THROTTLE_TTL_MS, limit: env.THROTTLE_LIMIT }],
```

and "insert before the closing bracket of `imports`" lands inside the throttler configuration.

### Idempotency

Before editing, check whether the identifier already appears as an element of the target array. If it does, do nothing and say nothing — re-running a command must not duplicate a registration. This is checked on the AST, not by string search, so an identifier inside a comment or an unrelated string never counts as present.

## Finding the root module

Candidates are probed in order, relative to the project root: `src/app.module.ts`, `app.module.ts`, then `src/<featureRoot-first-segment>/app.module.ts`. The first that exists and parses wins.

If none is found, that is a bail. A project with an unconventional root module name sets it explicitly:

```json
{ "domainDriver": { "rootModule": "src/core/root.module.ts" } }
```

This sits beside the existing `featureRoot` key and is validated the same way: a relative path inside the project, no `..`.

## When it bails

The edit is abandoned, nothing is written, and the paste-ready lines are printed, when any of these hold:

- `typescript` cannot be resolved from the project
- the root module file is not found
- the file does not parse
- no `@Module({ ... })` decorator with an object literal argument is found
- the target property exists but is not an array literal
- the target property is absent **and** cannot be added safely

A bail is a normal outcome printed as information, never a failure. The command that generated the files still succeeds, because the files were generated. The user is left exactly where today's behaviour leaves them:

```
ℹ️  Could not register AssetsModule automatically (no @Module decorator found in src/app.module.ts).
   Add to src/app.module.ts:
     import { AssetsModule } from './features/assets/assets.module';
     imports: [ ..., AssetsModule ]
```

## The off switch

```json
{ "domainDriver": { "autoRegister": false } }
```

Default `true`. When false, every registration becomes the printed hint above. This is the escape hatch for anyone who wants the write-only guarantee back, and the flag `--no-auto-register` does the same for a single command.

## What gets reported

Every successful edit prints what it changed, because a tool that silently edits your source is worse than one that does not edit it at all:

```
✅ Registered AssetsModule in src/app.module.ts
```

## Testing

- Unit tests for the editor against real `app.module.ts` shapes: an empty `imports: []`, a populated one, one containing a nested call expression with its own array literal, one with comments between elements, and one already containing the identifier.
- A test asserting comments and existing formatting survive an edit byte-for-byte outside the inserted range.
- A test per bail condition asserting the file is unchanged on disk and the hint was printed.
- An idempotency test: run the same registration twice, assert one entry and no second edit.
- The existing per-stack integration test gains a Nest case asserting the generated feature module is registered and the generated controllers appear in it.
- Coverage threshold stays at 80.

## Risks

- **The editor is only as good as its position arithmetic.** Inserting at a wrong offset produces a syntactically broken file. Mitigated by re-parsing the edited source before writing it: if the result does not parse, discard the edit and bail. This is the single most important safeguard and is cheap, since the parser is already loaded.
- **Resolving the user's `typescript` means running their version, not ours.** The API surface used here — `createSourceFile`, node positions, `forEachChild` — has been stable for many major versions, and a failure to resolve or parse is a bail rather than a crash.
- **Monorepos may have several root modules.** The probe finds one. The `rootModule` key is the answer for anything the probe gets wrong.
