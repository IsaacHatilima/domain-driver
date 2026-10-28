---
name: nest-api-responses
description: "Use when adding or changing a NestJS JSON response shape, the success envelope or its interceptor, the exception filter, error codes, paginated list output, or how validation, auth, rate-limit, Prisma, and unexpected errors reach the client."
---

# API responses

Applies to: `src/common/**`, `src/app.module.ts`. Project guidance and existing conventions win over these defaults.

## Envelope

Every JSON body has exactly these three keys:

| Key | Success | Failure |
|---|---|---|
| `success` | `true` | `false` |
| `data` | Output DTO, `{ items, nextCursor }` for paginated lists, or `null` | `null` |
| `error` | `null` | `{ code, message, details? }` |

`code` is a stable string from one `ErrorCode` map, and clients branch on it rather than on `message` or the status. `details` lists `{ path, message }` per invalid field, for validation errors only.

## Rules

- Handlers return output DTOs. One interceptor wraps successes and one `@Catch()` filter renders every error, both registered as `APP_INTERCEPTOR` and `APP_FILTER` providers in `AppModule` so e2e apps get them. Controllers never build envelopes or catch.
- Keep the real status: 200, 201, or 202 for success, and the real 4xx or 5xx for failure. A success without data is 200 with `data: null`, because a 204 can't carry the envelope.
- Actions throw the project's coded error, an `HttpException` subclass carrying `code`, through small factories such as `notFound('Project')`. New codes go in the `ErrorCode` map.
- The filter maps, in order:
  - coded errors to their status and `code`;
  - nestjs-zod's `ZodValidationException` to 400 `VALIDATION_ERROR`, with `details` from `getZodError().issues`;
  - `ThrottlerException` to 429, and other `HttpException`s to their status with a generic code;
  - Prisma's known errors: `P2002` and `P2003` to 409, `P2025` to 404;
  - anything else to 500 `INTERNAL_ERROR`.
- Repositories turn expected Prisma errors into specific codes, such as `EMAIL_ALREADY_REGISTERED` (see `database`). The filter's Prisma mapping only catches the rest.
- 5xx bodies carry a generic message, never exception text, SQL, stack traces, or file paths. Log the route template, status, code, and error type server-side, never the body or parameters.
- Streams and file downloads skip the envelope.
- Document each route's data schema and error codes with the project's OpenAPI decorator.

## Example

The Prisma branch of the filter's `render()`, after the coded, validation, throttling, and `HttpException` branches:

```ts
const PRISMA_ERRORS: Partial<Record<string, [HttpStatus, ErrorCode, string]>> = {
  P2002: [HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'The record already exists'],
  P2003: [HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'A related record is missing or still in use'],
  P2025: [HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Record not found'],
};

if (exception instanceof Prisma.PrismaClientKnownRequestError) {
  const known = PRISMA_ERRORS[exception.code];
  if (known) return { status: known[0], body: errorEnvelope(known[1], known[2]) };
}
return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: errorEnvelope(ErrorCode.INTERNAL_ERROR, 'Internal server error') };
```

## Verify

E2e tests cover each success status with exactly three keys; 400 with `details`, 401, 403, 404, 409, and 429; a 500 without internal details; and `data` without private fields.

Adapted in part from [nestjs-best-practices](https://github.com/IsaacHatilima/agent-nestjs-skills/tree/main/skills/nestjs-best-practices) (MIT).
