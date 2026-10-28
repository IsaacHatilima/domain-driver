---
name: nest-tests
description: "Use when writing, choosing, or running tests for a NestJS application, including unit tests for actions and schemas, e2e tests against an isolated Prisma test database, provider overrides, or deciding which tests a change needs."
---

# Tests

Applies to: `tests/**`, `src/**/*.spec.ts`, `jest.config.*`, `vitest.config.*`. Project guidance and existing conventions win over these defaults.

Use the project's runner and layout. `@nestjs/testing` works with Jest and Vitest; Nest 12 ESM projects default to Vitest.

## Unit tests

- Named `*.spec.ts`, for example under `tests/unit/` mirroring `src/`. They use no database and no network.
- Build the action with `Test.createTestingModule({ providers: [CreateProjectService, { provide: CreateProjectRepository, useValue: fake }] })` and `module.get()`, so injection tokens are exercised. Fake `$transaction` by calling its callback with a fake client.
- A fake keeps the real contract: the same return shapes, `null` where the real one returns `null`, and the same errors.
- Schema tests parse the Zod schema directly (see `dtos`).
- Request-scoped providers need `await module.resolve()`; `module.get()` throws for them.

## E2e tests

- Named `*.e2e-spec.ts`, one file per flow, such as `tests/feature/projects/create-project.e2e-spec.ts`.
- Build the app from `AppModule`, call the same HTTP setup function as `main.ts`, then `await app.init()`. Close it in `afterAll`.
- Override only external boundaries with `.overrideProvider()`: mail, payments, storage, and queues through `getQueueToken('projects')`. Keep actions, repositories, guards, and Prisma real.
- Assert the status, envelope, and error `code` (see `api-responses`, `security`).
- Use a dedicated test database from `.env.test`, never a development or shared one. Global setup applies the real migrations with `prisma migrate deploy`. Truncate every table except `_prisma_migrations` between tests.
- Run database suites serially, with Jest's `--runInBand` or Vitest's `fileParallelism: false`, because each one truncates the same database.

## Running tests

Run only the tests for the files and flows you changed. Never run the whole suite; CI does that.

- Select tests by path. For unit tests, `jest --findRelatedTests <changed files>` or `vitest related <changed files>` finds them through imports.
- After a fix, rerun only the failing tests and the tests of what the fix touched.
- Report what you ran and what you couldn't verify.

Adding comments to tasks changes the comment flows and the task page's data. Run their tests, not the change-password tests:

```sh
npx jest tests/unit/features/comments
npx jest --config tests/jest-e2e.json --runInBand tests/feature/comments tests/feature/tasks/show-task.e2e-spec.ts
```

## Example

```ts
const queue = { add: jest.fn() };
let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(getQueueToken('projects'))
    .useValue(queue)
    .compile();
  app = moduleRef.createNestApplication();
  configureHttpApp(app);
  await app.init();
});

afterAll(() => app.close());

it('rejects an owner id in the body', async () => {
  const response = await request(app.getHttpServer())
    .post('/projects')
    .set('Authorization', `Bearer ${await signIn(app)}`)
    .send({ name: 'Apollo', ownerId: 'someone-else' });

  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  expect(queue.add).not.toHaveBeenCalled();
});
```

`configureHttpApp` is the setup `main.ts` calls, and `signIn` is a shared helper that returns an access token.

Adapted in part from [nestjs-best-practices](https://github.com/IsaacHatilima/agent-nestjs-skills/tree/main/skills/nestjs-best-practices) (MIT).
