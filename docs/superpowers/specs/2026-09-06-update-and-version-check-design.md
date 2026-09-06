# Update command and version check

**Date:** 2026-09-06
**Status:** Draft for review
**Scope:** domain-driver 0.3.0

## 1. Goal

Users learn that a newer domain-driver exists and can pull it with one command, whatever way they installed it.

1. **Version check.** Every command (except `update`) checks the registry at most once per 24 hours and, when a newer version exists, prints one line after the command's own output: `ℹ️  domain-driver <latest> is available (you have <current>). Run: domain-driver update`.
2. **`update` command.** Detects how the running binary was installed and which package manager the project uses, runs the right upgrade with output streamed through, then re-runs `init` so the agent guidance refreshes.

## 2. Non-goals

- Replacing the binary in place or downloading tarballs. The package manager does the install.
- Tracking the project's framework versions (Next, React, Nest). Only domain-driver's own version is checked.
- Prerelease channels. Only `dist-tags.latest` is consulted.
- Updating through a package manager the tool cannot recognise. It falls back to npm and says so.

## 3. Version source

`currentVersion()` in `src/update/version.ts` reads `version` from the package's own `package.json` at runtime (`path.join(__dirname, '..', '..', 'package.json')` resolves from `dist/update/version.js` to the package root). `src/index.ts` uses it for `.version(...)`, removing the duplicated literal. If the file cannot be read the function returns `'0.0.0'` so nothing crashes; the check then compares against that and would print a notice, which is acceptable for a broken install.

`isNewer(latest, current)` compares `major.minor.patch` numerically. Anything that does not parse as three integers (a prerelease, an empty string) returns `false`, so a malformed registry answer never produces a notice.

## 4. Version check

### 4.1 Registry request

`fetchLatestVersion(fetchImpl = nodeFetch, timeoutMs = 1500): Promise<string | null>` does `GET https://registry.npmjs.org/-/package/domain-driver/dist-tags`, aborts after the timeout, and returns `dist-tags.latest` when the response is 200 with a string `latest`, otherwise `null`. It never throws.

The default `nodeFetch` is a small `FetchLike` on Node's `http`/`https` client rather than global `fetch`. The abort signal is passed to the request itself, so the timeout destroys the socket instead of only rejecting the promise, and the request's socket is unref'd, so an abandoned connect never keeps the event loop alive or delays process exit.

### 4.2 Cache

One JSON file, `update-check.json`, in the cache directory:

- `DOMAIN_DRIVER_CACHE_DIR` when set (used by tests), else `XDG_CACHE_HOME/domain-driver` when set, else `~/.cache/domain-driver`.
- Content: `{ "latest": string | null, "checkedAt": ISO-8601 }`.
- Fresh when `checkedAt` is less than 24 hours old. A failed fetch is cached as `latest: null` so an offline machine pays the timeout at most once a day.
- Unreadable or malformed cache is treated as absent. Write failures are ignored.

### 4.3 When the check runs

`shouldCheck(env, isTTY, commandName)` returns false when any of these hold: `env.CI` is set and not `''`, `'0'`, or `'false'`; `env.DOMAIN_DRIVER_NO_UPDATE_CHECK` is set and not one of those three; `env.NO_UPDATE_NOTIFIER` is set; `isTTY` is false; `commandName` is `update`.

Otherwise `checkForUpdate(deps)` reads the cache, fetches when stale, writes the cache, and returns the notice string when `isNewer(latest, currentVersion())`, else `null`. Every step is wrapped so the function never throws and never delays a command by more than the fetch timeout.

### 4.4 Wiring

In `src/index.ts` the check starts in the `preAction` hook (a promise that is not awaited) and is awaited in a `postAction` hook, which prints the notice if there is one. So the command's own output always comes first, and the network round trip overlaps the command's work. `init` keeps skipping stack detection but does get the check.

### 4.5 Notice

Exactly: `ℹ️  domain-driver 0.3.0 is available (you have 0.2.0). Run: domain-driver update` with the real versions substituted. One line, no colour.

## 5. `update` command

### 5.1 Install mode

`detectInstallMode(binPath, readFile)` takes the real path of the running script (`fs.realpathSync(process.argv[1])`) and finds the last `node_modules/domain-driver` segment. The directory before `node_modules` is the install root.

| Condition | Mode | Root |
|---|---|---|
| The path contains a `_npx` directory | `npx` | none |
| The install root, or one of its ancestors up to six levels up (pnpm stores the real package under node_modules/.pnpm/…), has a `package.json` whose `dependencies` or `devDependencies` names `domain-driver` | `local` | that directory |
| Anything else (no segment found, or no such `package.json`) | `global` | none |

### 5.2 Package manager

`detectPackageManager(root, readFile, exists)`:

1. `packageManager` field in `<root>/package.json` (`"pnpm@9.1.0"` gives `pnpm`) wins when it names `npm`, `pnpm`, `yarn`, or `bun`.
2. Otherwise by lockfile, first match: `bun.lock` or `bun.lockb` gives `bun`; `pnpm-lock.yaml` gives `pnpm`; `yarn.lock` gives `yarn`; `package-lock.json` or nothing gives `npm`.
3. For `yarn`, the lockfile's first line decides the flavour: `# yarn lockfile v1` is `yarn-classic`, anything else is `yarn-berry`.

### 5.3 Commands

| Mode | Manager | Command |
|---|---|---|
| local | npm | `npm install domain-driver@latest` |
| local | pnpm | `pnpm update domain-driver@latest` |
| local | yarn-classic | `yarn upgrade domain-driver@latest` |
| local | yarn-berry | `yarn up domain-driver@latest` |
| local | bun | `bun update domain-driver@latest` |
| global | any | `npm install -g domain-driver@latest` |

Local commands run with `cwd` set to the install root so the manager updates the right lockfile and keeps the dependency in the section it is already in.

### 5.4 Behaviour

`domain-driver update [--dry-run] [--check]`:

1. Detect mode and manager. In `npx` mode print `Nothing to update: you are running domain-driver through npx, which fetches the requested version each time. Use: npx domain-driver@latest <command>` and exit 0.
2. With `--dry-run`: print `Would run: <command>` (and `in <root>` for local) and exit 0 without contacting the registry.
3. Force a registry check (ignore the cache, but write it). If the registry answers and `latest` is not newer, print `domain-driver <current> is already the latest version.` and exit 0. If the registry is unreachable print `Could not reach the registry; updating to @latest anyway.` and continue.
4. With `--check`: print either the notice or the already-latest line and exit 0 without installing.
5. Run the command with `spawnSync(cmd, args, { stdio: 'inherit', cwd })`. On a non-zero exit, fail with `Update failed (exit <code>). Run it yourself: <command>`; when the mode is global, append ` (you may need sudo)`.
6. On success print `✅ domain-driver updated to <latest>` (or `to @latest` when the registry was unreachable). Then refresh guidance: in local mode run `runInit(root)`; in global mode run `runInit(process.cwd())` only when the current directory has a `package.json`. Print the init results with the same icons `init` uses.

`update` skips the stack detection hook and the version-check notice.

### 5.5 Injectable dependencies

`runUpdate(options, deps)` takes `{ env, homedir, now, fetchImpl, current, binPath, cwd, readFile, exists, spawn, init, log, writeCache }` with production defaults, so the command is unit-tested without touching the network or a package manager.

## 6. CLI surface

- `.version(currentVersion())`.
- `preAction`: skip stack detection for `init` and `update`; start the version check unless `shouldCheck` says no.
- `postAction`: await the check and print the notice.
- `update` command with `--dry-run` and `--check`.
- README gains an "Updating" section: the notice, `domain-driver update`, the two flags, the npx case, and the env var to disable the check.

## 7. Code layout

```
src/update/
  version.ts          currentVersion, isNewer
  registry.ts         fetchLatestVersion
  cache.ts            cacheDir, readCache, writeCache, isFresh
  check.ts            shouldCheck, checkForUpdate, formatNotice, NOTICE_TTL_MS
  install-mode.ts     detectInstallMode, InstallMode
  package-manager.ts  detectPackageManager, updateCommand
src/commands/update.ts  runUpdate, UpdateDeps, defaultDeps
```

## 8. Testing

- `isNewer`: greater, equal, lower, prerelease, garbage.
- `fetchLatestVersion`: 200 with latest, 200 without, non-200, thrown fetch, timeout via an aborting fake.
- Cache: absent, fresh, stale, malformed, write failure ignored; `cacheDir` precedence.
- `shouldCheck`: each skip reason and the run case.
- `checkForUpdate`: stale cache triggers fetch and writes; fresh cache skips fetch; newer produces the exact notice; equal produces null; fetch failure caches null.
- `detectInstallMode`: npx path, local path with matching `package.json`, path without `node_modules`, path whose root lacks the dependency.
- `detectPackageManager`: `packageManager` field wins, each lockfile, yarn classic vs berry, default npm.
- `updateCommand`: every row of 5.3.
- `runUpdate`: npx exit, already-latest exit, `--check`, `--dry-run`, successful spawn then init, failed spawn message with and without the sudo hint, unreachable registry path.
- CLI smoke: built binary prints the notice when the cache points at a newer version (seed the cache file through `DOMAIN_DRIVER_CACHE_DIR`), prints nothing with `CI=1`, and `update --dry-run` from a scratch local install prints the npm command.

Coverage stays above the 80 percent thresholds.
