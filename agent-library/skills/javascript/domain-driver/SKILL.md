---
name: javascript-domain-driver
description: "Scaffold domain-driven feature folders with the domain-driver CLI. Use when creating a feature, adding a layer (types, schema, repository, service, controller, component, container, hook) to an existing feature, or adding any operation beyond List, Show, Create, Update, and Delete."
---

# domain-driver

Every feature lives in one folder, and every action in every layer is one file. Use the CLI to create files; write the logic inside them by hand.

The flow is **page -> hook -> API -> service -> repository**, with schemas and types used along the way. Services and repositories sit behind the API, on the server. The hook calls the endpoint directly, so there is no client-side service or repository.

## Detect the stack

The tool reads `package.json` and prints `Stack: <stack> (detected), root: <dir>` before every command. Stacks: `next-fullstack`, `next-frontend`, `react`, `node` (Express, Fastify, Hono, or none), `nest`, `tanstack-start`. Override with `--stack <name>` if detection is wrong.
Where features are written can be overridden too: `--root <dir>` for one command, or a `domainDriver.featureRoot` key in `package.json` for the project. Read the root off the stack line rather than assuming the convention.
On Nest the tool registers what it generates: the feature module in the root module, and controllers, services and repositories in `<feature>.module.ts`. Do not add those by hand — it prints what it registered, and prints the lines to paste when it cannot. A bespoke action controller is placed before `Show<Entity>Controller` so its route is not swallowed by `/:id`.

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
| Component, container, hook | `npx domain-driver make:component users/UserCard`, `make:container users/UserContainer`, `make:hook users/User` |
| Refresh this guidance | `npx domain-driver init` |

`make:service` and `make:repository` generate the server side only, because that is the only side there is. They are unavailable on `next-frontend` and `react`, whose API lives outside the project; on those stacks the hook is the whole client.

Hooks are one file per action — `<Action><Entity>.hook.ts` exporting `use<Action><Entity>` — never a combined `use<Entity>.ts`. On `tanstack-start` they are TanStack Query hooks backed by a generated `<feature>.keys.ts`; elsewhere they are plain React state.

## Rules

1. **Scaffold before writing.** If a file the tool can generate does not exist yet, generate it. Do not create `services/FindActiveUsers.service.ts` by hand.
2. **One action, one file, every layer.** A new operation is a `make:action`, never a new method on an existing action class and never a branch inside Show or List.
3. **Keep the chain.** page -> hook -> API -> service -> repository. The hook calls the endpoint itself. A controller or route handler validates input and calls one service, a service calls one repository, and repositories do data access only. Never put a service or a repository in front of a `fetch`.
4. **Names.** Feature folders kebab-case. Entities, actions, and classes PascalCase. Action names include their noun: `archiveUser`, `findActiveUsers`.
5. **Do not widen the standard five.** List returns all, Show returns one by id, Create takes the create schema, Update takes id and the update schema, Delete takes id. Anything else is a bespoke action.
6. **Finish what the tool leaves open.** Fill the `TODO` in each repository. Add the printed line to `<feature>.routes.ts` on Node or register the printed classes in `<feature>.module.ts` on Nest. Add fields to the Zod schemas.

## Layout by stack

- Next.js: `app/<feature>` or `src/app/<feature>`; route handlers under `app/api/<feature>`.
- React and Node: `src/features/<feature>` or `features/<feature>`.
- Nest: `src/features/<feature>` when `src/features` exists, otherwise `src/<feature>`, with a `<feature>.module.ts`.
- TanStack Start: `src/routes/<feature>` or `routes/<feature>`; every layer folder is prefixed with `-` so the router ignores it, and the entry file is `index.tsx`, not `page.tsx`.
