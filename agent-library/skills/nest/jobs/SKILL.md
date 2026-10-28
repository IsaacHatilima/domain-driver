---
name: nest-jobs
description: "Use when adding or reviewing NestJS background work with BullMQ, such as mail, exports, imports, webhooks, or third-party calls, scheduling recurring jobs, or when a request is slow because it does work the client doesn't need to wait for."
---

# Jobs

Applies to: `src/**/*.processor.ts`, and `BullModule` registration in modules. Project guidance and existing conventions win over these defaults.

## Setup

- Install `@nestjs/bullmq`, `bullmq`, and `ioredis`; BullMQ 6 no longer installs a Redis client itself.
- Register `BullModule.forRootAsync()` once, with the connection and `defaultJobOptions` from validated config. Feature modules register their queues with `BullModule.registerQueue({ name: 'projects' })`, and producers inject `@InjectQueue('projects') queue: Queue`.

## Rules

- Queue slow or external work the response doesn't depend on: mail, exports, imports, outbound webhooks, and third-party calls.
- A processor is a transport like a controller. A `@Processor('projects')` class extends `WorkerHost`, validates `job.data` with a Zod schema in `process()`, and calls one action, which owns the queries and the transaction (see `actions`).
- Enqueue after the transaction resolves, never inside the callback. When losing a job after the commit is unacceptable, write an outbox row in the same transaction and relay it to the queue.
- Payloads carry ids and small values. Redis stores them in plain text, so never put Prisma rows, secrets, tokens, or personal data in them.
- Make the work idempotent: a retry must not charge, send, or insert twice. Give each job a deterministic `jobId` (it can't contain `:`), and have the action check for the state it is meant to produce.
- Bound retries with `attempts` and `backoff: { type: 'exponential', delay }`, and set `removeOnComplete` and `removeOnFail`. Throw to retry, or throw `UnrecoverableError` when retrying can't help, such as for an invalid payload.
- Log failures in an `@OnWorkerEvent('failed')` handler with the job id and name, never the payload.
- Recurring work uses `queue.upsertJobScheduler(id, { pattern }, { name, data })` at startup. BullMQ 6 removed the `repeat` option; never use `setInterval`.
- `@Process()` and `@OnQueueFailed()` belong to the older `@nestjs/bull` and don't exist in `@nestjs/bullmq`.
- Request code never starts a promise without awaiting it. Give it a `.catch()` that logs, or make it a job.

## Example

```ts
const IndexProjectJobSchema = z.object({ projectId: z.uuid() });

@Processor('projects')
export class IndexProjectProcessor extends WorkerHost {
  private readonly logger = new Logger(IndexProjectProcessor.name);

  constructor(private readonly indexProject: IndexProjectService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const payload = IndexProjectJobSchema.safeParse(job.data);
    if (!payload.success) throw new UnrecoverableError('Invalid index payload');
    await this.indexProject.handle(payload.data.projectId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Job ${job?.id} (${job?.name}) failed: ${error.name}`);
  }
}
```

A processor receives every job on its queue, so a queue with several job names switches on `job.name`.

## Verify

E2e tests override the queue with `getQueueToken('projects')` and assert what was added. Separate tests call `process()` with real actions and faked external services, because a queue fake proves the dispatch, not the work (see `tests`).

Adapted in part from [nestjs-best-practices](https://github.com/IsaacHatilima/agent-nestjs-skills/tree/main/skills/nestjs-best-practices) (MIT).
