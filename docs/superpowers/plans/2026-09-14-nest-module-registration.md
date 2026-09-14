# Nest module registration — implementation plan

**Spec:** `docs/superpowers/specs/2026-09-14-nest-module-registration-design.md`
**Base:** `fix/feature-root-override` (PR #9), whose `domainDriver` config block these keys extend.

## Global Constraints

- The edit is abandoned and nothing is written unless the edited source re-parses cleanly. This is the safeguard that makes corrupting a boot file unreachable; it is not optional.
- Positions come from the AST. No string scanning for brackets — a real root module nests an array literal inside `ThrottlerModule.forRootAsync`, and "insert before the closing bracket" lands inside it.
- Never re-emit the AST. Apply text-range edits to the original source so comments and hand-chosen ordering survive byte-for-byte outside the inserted range.
- `typescript` is resolved from the consuming project, never added as a runtime dependency here.
- Every bail is informational: the files were still generated, so the command still succeeds.
- Registration is idempotent, checked on the AST, so an identifier in a comment never counts as present.
- Nest only. Other stacks are untouched.
- Coverage stays at or above 80. Commit subjects `<type>: <description>` with the Co-Authored-By trailer.

## Tasks

1. **Resolve the project's TypeScript.** `src/nest/typescript.ts` exposing `loadTypeScript(cwd): TsLike | null`. Returns null rather than throwing when unresolvable. Typed against the narrow surface actually used (`createSourceFile`, `ScriptTarget`, `SyntaxKind`, `forEachChild`) so the project's version is not assumed to match ours.

2. **The editor.** `src/nest/register.ts` exposing a pure `registerInModule(source, { identifier, importPath, property }): RegisterResult`, where the result is either the edited source, `already-registered`, or a bail with a reason. Pure string in, string out — no filesystem, so every edge case is a unit test. Covers: empty array, populated array, nested call expression with its own array, comments between elements, identifier already present, missing `@Module`, property absent, property not an array, and the post-edit re-parse guard.

3. **Locating the root module.** `src/nest/root-module.ts`: probe `src/app.module.ts`, `app.module.ts`, `src/<first segment of featureRoot>/app.module.ts`, else the `domainDriver.rootModule` key. Returns a path or null.

4. **Config and the off switch.** `rootModule` and `autoRegister` on the `domainDriver` key, validated alongside `featureRoot`; `--no-auto-register` for a single command. Default on.

5. **Wiring.** `make:feature` registers `<Entity>Module` in the root module. `make:controller`, `make:service`, `make:repository` and `make:action` register their generated classes in `<feature>.module.ts`, replacing the current `hintRegisterInModule` call sites. Successful edits print what changed; bails print the paste-ready lines.

6. **Docs and version.** README section on registration and the two new keys, `src/init/content.ts` so agents know registration is automatic, version bump.

## Execution

Implemented inline with TDD rather than dispatched per task — the editor is one tightly-coupled unit whose tests are the design, and splitting it across context-free subagents would cost more than it buys. One whole-diff review at the end, which is where the last feature's two real bugs were caught.
