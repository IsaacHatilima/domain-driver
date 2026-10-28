---
name: nest-security
description: "Use when adding or reviewing NestJS authentication or permission guards, public routes, ownership or tenant scoping, rate limits, CORS or helmet, JWT or refresh-token handling, password hashing, or how secrets reach the app."
---

# Security

Applies to: `src/security/**`, `src/config/**`, `src/app.module.ts`, `src/main.ts`. Project guidance and existing conventions win over these defaults.

## Guards

- Register guards as `APP_GUARD` providers in `AppModule`, in this order: `ThrottlerGuard`, authentication, then permissions. They run in registration order, and e2e apps built from `AppModule` get them too.
- Authentication denies by default. A `@Public()` decorator opts a route out, and the guard reads it with `Reflector.getAllAndOverride(KEY, [context.getHandler(), context.getClass()])`.
- The authentication guard attaches the principal to the request, and handlers read it through a param decorator (see `controllers`). Never check `request.user` inside handlers.
- A permission guard also runs on public routes, where no principal exists. Return early when the route needs no permission, and deny when the principal is missing.

## Ownership and scoping

- Guards decide what the actor may do. The action's queries decide which records they may touch: every `where` includes the owner or tenant from the actor, such as `{ id, workspaceId: actor.workspaceId }`.
- A scoped lookup that finds nothing answers 404, so other tenants' ids stay hidden.
- Owner, tenant, and role columns are set from the actor, never from input.

## Rate limits

- Configure `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])`; `ttl` is in milliseconds. Apply stricter named presets with `@Throttle()` to login, password reset, verification, and email-sending routes.
- Health checks get `@Public()` and `@SkipThrottle()`.
- Several instances need shared throttler storage. Behind a proxy, set `trust proxy`, or every client shares the proxy's IP.

## HTTP hardening

- Apply `helmet()` and CORS in the shared HTTP setup function (see `architecture`).
- CORS allows an explicit origin list from config. Never pair `credentials: true` with a wildcard origin.

## Credentials and secrets

- Secrets come from the validated environment schema with minimum lengths. Never use literals or `|| 'default'` fallbacks, and keep `.env` out of git.
- Hash passwords with the project's hasher, such as argon2. Never log or return them.
- JWTs: take the secret from config, keep access tokens short-lived, verify issuer and audience, and limit claims to `sub` and ids. Check the session on each request when logout or revocation must apply at once.
- Refresh and reset tokens are random (`randomBytes(32)`), stored hashed, single-use, rotated on use, and revoked on logout and password change.
- Responses carry output DTOs only (see `dtos`), so hashes and secrets never leave the server.

## Verify

E2e tests cover:
- 401 without a token, and with an expired or revoked one;
- 403 without the permission;
- 404 for another tenant's record;
- 429 on a throttled route;
- responses without secret fields.

Adapted in part from [nestjs-best-practices](https://github.com/IsaacHatilima/agent-nestjs-skills/tree/main/skills/nestjs-best-practices) (MIT).
