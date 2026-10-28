---
name: nest-actions
description: "Use when creating, refactoring, or reviewing a NestJS action or service that performs one business operation, or deciding its typed input, actor, transaction, side effects, or return value."
---

# Actions

Applies to: `src/**/services/*.service.ts`, or `src/**/*.action.ts` in a project that uses that name. Project guidance and existing conventions win over these defaults.

An action is one business operation in its own class. domain-driver generates it as `services/CreateProject.service.ts` with `CreateProjectService.handle()`. A project that names them `CreateProjectAction` follows the same rules.

## Class shape

- An `@Injectable()` class with one public `async handle()`, named verb, noun, then class type: `ArchiveProjectService`.
- A new operation is a new class (`npx domain-driver make:action projects/Project archiveProject`), never a new method on another action or a branch inside List or Show.
- Inject repositories, other actions, and queues through the constructor. Keep per-call state in local variables.

## Inputs

- Request data arrives as the schema's inferred type, such as `CreateProject`, already validated and normalized (see `dtos`). Never accept a request object, `any`, or a loose record.
- Pass the actor explicitly, as in `handle(actor: AuthPrincipal, data: CreateProject)`. Route ids arrive as typed parameters.
- Owner, tenant, and team ids come from the actor or a loaded parent, never from input. Every read is scoped to records the actor may see (see `security`).

## Persistence and transactions

- Repositories run the queries (see `database`); the action makes the decisions.
- The action owns the transaction. When it writes more than once, it opens `this.prisma.$transaction(async (tx) => …)` once and passes `tx` to every repository call inside. Repositories and nested actions never open their own. A project that uses `@Transactional()` from `@nestjs-cls/transactional` keeps it.
- Hash passwords and call external services before the transaction opens.
- Jobs, events, and mail that depend on the write start after `$transaction` resolves, never inside the callback (see `jobs`).

## Results and failures

- Return what the caller needs, typed: usually the output DTO mapped from the Prisma result (see `dtos`). Deletes return `void`, and checks return `boolean`. Never return a Prisma row.
- Broken business rules throw the project's coded error, such as `notFound('Project')` when a scoped lookup returns `null`. The exception filter renders it (see `api-responses`).

## Example

```ts
@Injectable()
export class CreateProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly createProject: CreateProjectRepository,
    private readonly addMember: AddProjectMemberRepository,
    @InjectQueue('projects') private readonly queue: Queue,
  ) {}

  async handle(actor: AuthPrincipal, data: CreateProject): Promise<Project> {
    const project = await this.prisma.$transaction(async (tx) => {
      const created = await this.createProject.handle({ name: data.name, ownerId: actor.userId }, tx);
      await this.addMember.handle({ projectId: created.id, userId: actor.userId, role: 'owner' }, tx);
      return created;
    });

    await this.queue.add('index', { projectId: project.id }, { jobId: `index-${project.id}` });

    return toProject(project);
  }
}
```

The project and its owner membership commit together, and the job is queued only after the commit.

## Verify

Unit tests fake the repositories, `$transaction`, and the queue, and cover each branch and error. E2e tests prove the writes commit and roll back together (see `tests`).
