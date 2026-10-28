---
name: nest-database
description: "Use when writing NestJS persistence code with Prisma: setting up PrismaService, adding models or relations to schema.prisma, writing repository queries, fixing N+1 queries or over-fetching, wrapping writes in a transaction, or paginating a list."
---

# Database

Applies to: `prisma/schema.prisma`, `src/database/**`, `src/**/repositories/*.repository.ts`. Project guidance and existing conventions win over these defaults.

## Prisma 7 setup

- Keep `prisma` and `@prisma/client` on the same version.
- The generator is `provider = "prisma-client"` with a required `output`, such as `"../src/generated/prisma"`; CommonJS apps add `moduleFormat = "cjs"`. Import `PrismaClient` and `Prisma` from `<output>/client`. The datasource URL lives in the Prisma config file.
- Run `npx prisma generate` after every schema change (see `migrations`).
- `PrismaService extends PrismaClient`, passes a driver adapter to `super({ adapter: new PrismaPg({ connectionString }) })` from validated config, and connects and disconnects in `onModuleInit` and `onModuleDestroy`. A global `DatabaseModule` exports it.

## Schema conventions

- Models are singular PascalCase with camelCase fields, mapped to snake_case with `@@map("projects")` and `@map("owner_id")`.
- Entity ids are `String @id @default(uuid()) @db.Uuid`. `createdAt` uses `@default(now())` and `updatedAt` uses `@updatedAt`, both `@db.Timestamptz`.
- Every relation states `onDelete`: `Restrict` by default, `Cascade` only for truly dependent rows, `SetNull` on optional keys. Index every foreign key with `@@index`; PostgreSQL doesn't.
- Store money as integer minor units, never `Float`. Declare uniqueness with `@unique` or `@@unique`, so the database decides races.

## Repositories

- One class per statement with one public `handle()`, as domain-driver generates. Repositories run queries; they hold no business rules and call no other repository.
- Select only what the caller maps, with the select exported beside the mapper (see `dtos`). Load relations with nested `select` or `include` and counts with `_count`, never with a query inside a loop.
- Write each column explicitly, such as `data: { name: input.name }`. Never pass or spread a DTO into `data`.
- Translate expected errors where they happen: catch `Prisma.PrismaClientKnownRequestError` with code `P2002` and throw the domain error. Rethrow anything else.
- A repository used inside transactions takes the client last: `db: Prisma.TransactionClient = this.prisma`.

## Transactions

- The action opens the transaction and passes `tx` to each repository call (see `actions`). A call that omits `tx` silently runs outside it.
- Interactive transactions time out after 5 seconds by default, so keep slow work out of the callback. Retry the whole transaction a bounded number of times on `P2034`, a write conflict or deadlock.
- For read-modify-write, use atomic updates such as `{ stock: { decrement: 1 } }`, or `updateMany` with the expected state in `where`, then check `count`.

## Pagination

Every list has a capped `limit`. Large lists page by cursor (`take`, `cursor: { id }`, `skip: 1`) with an `orderBy` ending in `id`, and return `{ items, nextCursor }`.

## Example

```ts
@Injectable()
export class CreateProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async handle(input: NewProject, db: Prisma.TransactionClient = this.prisma): Promise<ProjectRecord> {
    try {
      return await db.project.create({
        data: { name: input.name, ownerId: input.ownerId },
        select: projectSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw projectNameTaken();
      }
      throw error;
    }
  }
}
```

`projectNameTaken()` is the project's coded 409 error (see `api-responses`).

Adapted in part from [nestjs-best-practices](https://github.com/IsaacHatilima/agent-nestjs-skills/tree/main/skills/nestjs-best-practices) (MIT).
