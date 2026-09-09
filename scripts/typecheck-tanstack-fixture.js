#!/usr/bin/env node
'use strict';

// Compiles a generated tanstack-start feature against the real TanStack Start
// packages under `strict`, inside a throwaway temp directory. On-demand only:
//
//   npm run typecheck:tanstack-fixture
//
// This is deliberately NOT part of `npm test` or CI. It installs from the
// network, is slow, and every other test in this repo verifies generated code
// as strings. This script is the one place that compiles it for real.
//
// What it proves:
//
//   1. `createServerFn(...).validator(<ZodSchema>)` accepts a bare Zod schema
//      (no `(d) => Schema.parse(d)` wrapper) against the real package types.
//   2. The whole vertical slice - route, container, hooks, client
//      repositories, server functions - compiles as one consumer project.
//
// One wrinkle that is NOT a domain-driver defect: a generated route file only
// type-checks inside a project that has run TanStack Router's own file-route
// codegen. `FileRoutesByPath` (the interface `createFileRoute`'s literal-path
// argument is checked against) is empty until something augments it, and a
// real project gets that augmentation from `routeTree.gen.ts`, which the
// framework's own Vite plugin regenerates on every dev/build run. domain-driver
// scaffolds a feature, not the app shell (see the design doc's Scope
// section), so it never produces a root route or a route tree - the same way
// it does not produce the project's `vite.config.ts`. This script supplies
// both, the way `create-tsrouter-app` or a first `vite dev` would, so the
// fixture is a project the router can actually resolve.
//
// See docs/superpowers/specs/2026-09-09-tanstack-start-and-per-action-hooks-design.md
// for the design this fixture is verifying.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const FEATURE = 'cat';
const ENTITY = 'Cat';

// The profile's own floor (see the design doc's Risks section), not
// domain-driver's -- domain-driver itself still supports Node >=20.
const MIN_NODE = [22, 12, 0];

// Exact versions, pinned deliberately: this fixture exists to catch drift
// between what the renderers assume and what the real packages ship, so a
// caret range that quietly resolves to a newer major would defeat the point.
const DEPENDENCIES = Object.freeze({
    '@tanstack/react-start': '1.168.50',
    '@tanstack/react-router': '1.170.33',
    '@tanstack/react-query': '5.102.8',
    zod: '4.6.0',
    react: '19.3.0',
    'react-dom': '19.3.0',
});

const DEV_DEPENDENCIES = Object.freeze({
    // Standalone route-tree codegen -- see the module comment above. This is
    // the one dependency the fixture needs that a generated feature does not
    // import; everything else here is a real, importable dependency of the
    // generated code.
    '@tanstack/router-cli': '1.167.35',
    '@types/react': '19.3.0',
    '@types/react-dom': '19.3.0',
});

function log(message) {
    process.stdout.write(`${message}\n`);
}

function run(command, args, cwd) {
    log(`$ ${command} ${args.join(' ')}`);
    execFileSync(command, args, { cwd, stdio: 'inherit' });
}

function localBin(fromDir, name) {
    const suffix = process.platform === 'win32' ? '.cmd' : '';
    return path.join(fromDir, 'node_modules', '.bin', `${name}${suffix}`);
}

function assertSupportedNode() {
    const current = process.versions.node.split('.').map(Number);
    for (let i = 0; i < MIN_NODE.length; i += 1) {
        if (current[i] > MIN_NODE[i]) return;
        if (current[i] < MIN_NODE[i]) {
            throw new Error(
                `tanstack-start requires Node >=${MIN_NODE.join('.')} (its own floor, not domain-driver's). ` +
                    `Current: ${process.versions.node}.`
            );
        }
    }
}

function buildDomainDriver() {
    log('Building domain-driver...');
    run('npm', ['run', 'build'], REPO_ROOT);
    const featureModule = path.join(REPO_ROOT, 'dist', 'commands', 'feature.js');
    if (!fs.existsSync(featureModule)) {
        throw new Error(`Build did not produce ${featureModule}`);
    }
}

function writeFixtureProject(dir) {
    const packageJson = {
        name: 'domain-driver-tanstack-fixture',
        private: true,
        version: '0.0.0',
        type: 'module',
        dependencies: DEPENDENCIES,
        devDependencies: DEV_DEPENDENCIES,
    };
    fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

    const tsconfig = {
        compilerOptions: {
            target: 'ES2022',
            lib: ['ES2022', 'DOM'],
            module: 'ESNext',
            moduleResolution: 'Bundler',
            jsx: 'react-jsx',
            strict: true,
            skipLibCheck: true,
            esModuleInterop: true,
            forceConsistentCasingInFileNames: true,
            isolatedModules: true,
            noEmit: true,
        },
        include: ['**/*.ts', '**/*.tsx'],
    };
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);
}

function writeRootRoute(dir) {
    // Every TanStack Router project needs exactly one of these; domain-driver
    // scaffolds features, not the app shell (see the design doc's Scope
    // section), so nothing under test generates it. This is fixture
    // furniture, the same role package.json and tsconfig.json play above.
    const routesDir = path.join(dir, 'src', 'routes');
    fs.mkdirSync(routesDir, { recursive: true });
    fs.writeFileSync(
        path.join(routesDir, '__root.tsx'),
        `import { createRootRoute, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => <Outlet />,
});
`
    );
}

async function scaffoldFeature(dir) {
    const originalCwd = process.cwd();
    process.chdir(dir);
    try {
        // Loaded from dist, not src: this exercises exactly what ships to
        // consumers, via the same renderers `stacks.test.ts` walks.
        // eslint-disable-next-line global-require, import/no-dynamic-require
        const { makeFeature } = require(path.join(REPO_ROOT, 'dist', 'commands', 'feature.js'));
        await makeFeature(FEATURE, true, ENTITY);
    } finally {
        process.chdir(originalCwd);
    }
}

function installDependencies(dir) {
    log('Installing pinned dependencies (this contacts the npm registry)...');
    run('npm', ['install', '--no-audit', '--no-fund'], dir);
}

function generateRouteTree(dir) {
    log('Generating the route tree (tsr generate)...');
    run(localBin(dir, 'tsr'), ['generate'], dir);
}

function typeCheck(dir) {
    log('Type-checking the generated feature under strict...');
    // Reuses this repo's own pinned `typescript`, rather than installing a
    // second copy into the fixture: it is already the exact version this
    // repo is built and tested against.
    run(localBin(REPO_ROOT, 'tsc'), ['--noEmit', '-p', 'tsconfig.json'], dir);
}

// Required files from different layers of the generated feature. These are
// checked immediately after scaffolding to catch regressions where a layer
// silently produces nothing while the rest succeeds. One file per layer
// directory (see the tanstack-start profile's `folders`), built from
// FEATURE/ENTITY rather than hardcoded so this stays in sync with the name
// scaffolded above.
const FEATURE_ROOT = `src/routes/${FEATURE}`;
const REQUIRED_GENERATED_FILES = Object.freeze([
    // Route entry point: nothing else in the generated graph imports it, so
    // a renderer regression emitting nothing for it would otherwise type-
    // check clean without this check.
    `${FEATURE_ROOT}/index.tsx`,
    // Types layer
    `${FEATURE_ROOT}/-types/${ENTITY}.types.ts`,
    // Schemas layer (write actions only -- there is no "List" schema)
    `${FEATURE_ROOT}/-schemas/Create${ENTITY}.schema.ts`,
    // Component layer
    `${FEATURE_ROOT}/-components/${ENTITY}.tsx`,
    // Container layer
    `${FEATURE_ROOT}/-containers/${ENTITY}Container.tsx`,
    // Hooks layer
    `${FEATURE_ROOT}/-hooks/List${ENTITY}.hook.ts`,
    // Client services layer
    `${FEATURE_ROOT}/-client/services/List${ENTITY}.service.ts`,
    // Client repositories layer
    `${FEATURE_ROOT}/-client/repositories/List${ENTITY}.repository.ts`,
    // Server functions layer (controller)
    `${FEATURE_ROOT}/-server/functions/List${ENTITY}.fn.ts`,
    // Server services layer
    `${FEATURE_ROOT}/-server/services/List${ENTITY}.service.ts`,
    // Server repositories layer
    `${FEATURE_ROOT}/-server/repositories/List${ENTITY}.repository.ts`,
]);

function assertScaffoldingProduced(dir) {
    const missing = REQUIRED_GENERATED_FILES.filter((file) => !fs.existsSync(path.join(dir, file)));
    if (missing.length > 0) {
        throw new Error(
            `Scaffolding did not produce expected files:\n  - ${missing.join('\n  - ')}`
        );
    }
}

async function main() {
    assertSupportedNode();
    buildDomainDriver();

    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-tanstack-fixture-'));
    log(`Fixture directory: ${fixtureDir}`);

    try {
        writeFixtureProject(fixtureDir);
        writeRootRoute(fixtureDir);
        await scaffoldFeature(fixtureDir);
        assertScaffoldingProduced(fixtureDir);
        installDependencies(fixtureDir);
        generateRouteTree(fixtureDir);
        typeCheck(fixtureDir);
        log('');
        log(`OK: the generated "${FEATURE}" feature type-checks under strict against the real TanStack Start packages.`);
        fs.rmSync(fixtureDir, { recursive: true, force: true });
    } catch (error) {
        log('');
        log(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
        log(`Fixture left on disk for inspection: ${fixtureDir}`);
        process.exitCode = 1;
    }
}

main();
