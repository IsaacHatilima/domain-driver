---
name: tanstack-start-actions
description: "Use when adding, changing, or reviewing a TanStack Start server function, its validator or auth middleware, or the hook or loader that calls it and refreshes data afterwards."
---

# TanStack Start server functions

Applies to: `src/routes/<feature>/-server/functions/*.fn.ts` and the hooks and loaders that call them. Project guidance (`AGENTS.md`, `CLAUDE.md`) wins over these defaults.

A server function is a public RPC endpoint that anyone can call without loading its page. domain-driver generates one per action. Server routes (`server.handlers`) are raw HTTP endpoints for webhooks and other clients; domain-driver doesn't generate them, and they are not covered here.

## Rules

- **One function per file.** `-server/functions/<Action><Entity>.fn.ts` exports `<action><Entity>` from `createServerFn({ method })`: `GET`, the default, for reads and `POST` for writes. Import it statically; clients get an RPC stub.
- **Validate with `.validator()`.** Pass the feature's `-schemas/<Action><Entity>.schema.ts`, wrapped in `z.object({ id, data })` when the call names a record. `@tanstack/react-start` 1.169 removed the older `.inputValidator()` name; match the installed version.
- **Authenticate with middleware.** Attach the project's auth middleware with `.middleware([...])` and read the caller from `context`. A route's `beforeLoad` does not protect the function. When the input names a record, check the caller may change it.
- **Delegate.** The handler calls the matching service's `handle()`. Only server functions import services.
- **Return plain data.** Return what the UI needs, never a whole record. Strict mode, the default, type-checks that inputs and results serialize; keep it on.
- **Throw `redirect()` or `notFound()`** from `@tanstack/react-router`. Loaders and `beforeLoad` handle both. In a component, wrap the function in `useServerFn()` so a thrown redirect navigates.
- **Refresh what changed.** For loader data, `await router.invalidate()` after the call. For TanStack Query data, as in domain-driver's hooks, invalidate the feature's query keys in `onSuccess`.

## Example

```ts
// src/routes/users/-server/functions/UpdateUser.fn.ts
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/auth.middleware';
import { UpdateUserSchema } from '../../-schemas/UpdateUser.schema';
import { UpdateUserService } from '../services/UpdateUser.service';

const service = new UpdateUserService();

export const updateUser = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), data: UpdateUserSchema }))
  .handler(async ({ data, context }) => {
    if (context.user.id !== data.id) throw new Error('Forbidden');

    const user = await service.handle(data.id, data.data);
    return { id: user.id, name: user.name };
  });
```

This is domain-driver's generated function plus auth. The project's `authMiddleware` puts the signed-in `user` on `context`.

## Verify

Call the function with no session and as another user. Both must fail before the service runs.
