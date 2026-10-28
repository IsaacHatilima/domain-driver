---
name: nest-controllers
description: "Use when adding or changing a NestJS controller or route, wiring a DTO, pipe, or guard to an endpoint, choosing an HTTP method or status code, or reading the authenticated actor in a handler."
---

# Controllers

Applies to: `src/**/controllers/*.controller.ts`. Project guidance and existing conventions win over these defaults.

## Rules

- One controller class per action, with one `handle()` method, as domain-driver generates: `CreateProjectController`. `@Controller('projects')` sets the path prefix.
- `handle()` takes validated input, calls exactly one action, and returns its result:
  - the body as `@Body() body: CreateProjectDto`, and the query as `@Query() query: ListProjectsDto` (see `dtos`);
  - path ids through a pipe, `@Param('id', ParseUUIDPipe) id: string`. domain-driver generates a bare `@Param('id')`, so add the pipe;
  - the actor through a param decorator that reads what the authentication guard attached. Never take a user, owner, or tenant id from the body.
- Controllers hold no queries, business rules, try/catch blocks, or response wrapping. Errors reach the exception filter, and the interceptor adds the envelope (see `api-responses`).
- Never inject `@Res()`; it bypasses interceptors, so the envelope is skipped.
- Declare the action's output DTO as the return type, such as `Promise<Project>`.

## Methods, statuses, and routes

- `@Post()` creates, and `@Patch(':id')` applies a partial update. Change domain-driver's generated `@Put` to `@Patch` when the DTO is partial, and a generated `@Get` to `@Post` or `@Patch` when the action changes state.
- Nest answers 201 for POST and 200 otherwise. Set other statuses with `@HttpCode()`, such as 202 for queued work. An action that returns nothing answers 200 with `data: null`, so remove the `@HttpCode(204)` domain-driver generates on Delete.
- Nest matches routes in registration order, so `GET /projects/archived` must come before `GET /projects/:id`. domain-driver inserts bespoke controllers before `Show<Entity>Controller`; keep that order when editing the module.

## Guards and docs

- Authentication is global (see `security`). Open a route with `@Public()`, and apply the project's `@Throttle()` presets to credential and email routes.
- Put permission decorators on the class or method, never permission checks in the handler.
- Document with `@ApiTags`, `@ApiBearerAuth`, and the project's response decorator built from the output schema.

## Example

```ts
@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class CreateProjectController {
  constructor(private readonly service: CreateProjectService) {}

  @Post()
  handle(@CurrentAuth() auth: AuthPrincipal, @Body() body: CreateProjectDto): Promise<Project> {
    return this.service.handle(auth, body);
  }
}
```

`CurrentAuth` returns the principal that the authentication guard attached to the request.

## Verify

E2e tests (see `tests`) cover the status and envelope, a 400 for an unknown or invalid field, a 401 without a token, and a 404 for another tenant's record.

Adapted in part from [nestjs-best-practices](https://github.com/IsaacHatilima/agent-nestjs-skills/tree/main/skills/nestjs-best-practices) (MIT).
