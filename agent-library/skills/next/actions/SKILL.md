---
name: next-actions
description: "Use when adding, changing, or reviewing a Next.js Server Action, a form or button that submits to one, or the revalidation, redirect, or returned state after it."
---

# Next Server Actions

Applies to: `app/<feature>/server/actions/*.action.ts` and the forms that call them. Project guidance (`AGENTS.md`, `CLAUDE.md`) wins over these defaults.

A Server Action is a public POST endpoint. For the app's own forms it replaces domain-driver's route handler and fetch hook. Route handlers (`app/api/**/route.ts`) remain the controller layer for other HTTP clients and are not covered here.

## Rules

- **One action per file.** `server/actions/<Action><Entity>.action.ts` starts with `'use server'` and exports one async `<action><Entity>Action`.
- **Check auth inside every action.** A page or layout check does not protect it. Take the caller from the session, not from arguments. When the client names a record, check the caller may change it.
- **Validate with Zod.** `safeParse` the input with the feature's `schemas/<Action><Entity>.schema.ts` and pass on only `parsed.data`.
- **Delegate.** Call the matching service's `handle()`. No queries or business rules in the action.
- **Return expected failures, throw the rest.** Under `useActionState`, the action takes `(previousState, formData)` and returns a typed state. Throw only what the user can't fix; the nearest `error.tsx` shows it.
- **Refresh, then redirect.** `revalidatePath(path)` refreshes one route. `updateTag(tag)` shows the user their write at once. `revalidateTag(tag, 'max')` refreshes in the background. `refresh()` re-renders the page without touching the cache. `redirect()` throws, so call it last and outside `try`.
- **Return little.** Arguments and results must serialize: primitives, plain objects, arrays, `Date`, `Map`, `Set`, `FormData`. Class instances and ordinary functions don't. Return what the UI renders, never a whole record. Bodies over 1 MB fail unless `serverActions.bodySizeLimit` is raised.

## Example

```ts
// app/users/server/actions/UpdateUser.action.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/current-session';
import { UpdateUserSchema, type UpdateUser } from '../../schemas/UpdateUser.schema';
import { UpdateUserService } from '../services/UpdateUser.service';

export type UpdateUserState =
  | { status: 'idle' }
  | { status: 'invalid'; errors: Partial<Record<keyof UpdateUser, string[]>> }
  | { status: 'saved'; name: string };

const service = new UpdateUserService();

export async function updateUserAction(
  _previous: UpdateUserState,
  formData: FormData,
): Promise<UpdateUserState> {
  const session = await requireSession();

  const parsed = UpdateUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: 'invalid', errors: z.flattenError(parsed.error).fieldErrors };
  }

  const user = await service.handle(session.user.id, parsed.data);
  revalidatePath('/users');
  return { status: 'saved', name: user.name };
}
```

`requireSession()` redirects anonymous callers. The id comes from the session, so nobody can edit another user.

## Verify

Call the action without a session and with invalid input. Neither may reach the service.
