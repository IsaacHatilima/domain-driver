---
name: nest-migrations
description: "Use when adding or changing a Prisma model, table, column, index, relation, or constraint in a NestJS app, writing a backfill, or running migrations locally, in CI, or in production."
---

# Migrations

Applies to: `prisma/schema.prisma`, `prisma/migrations/**`. Project guidance and existing conventions win over these defaults.

## Rules

- Change `schema.prisma` first, following the conventions in `database`. Then run `npx prisma migrate dev --name add_project_archived_at` against your local database.
- Run `npx prisma generate` afterwards. In Prisma 7, `migrate dev` no longer regenerates the client.
- Commit the schema and the new `prisma/migrations/<timestamp>_<name>/migration.sql` together.
- Read the generated SQL before committing. Create the migration with `--create-only` when it needs editing:
  - Renaming a field generates a drop and an add, which loses data. Edit it into `RENAME COLUMN`, or keep the column and rename only the Prisma field with `@map`.
  - Data backfills and SQL the schema can't express go into the same edited file.
- Never edit a migration that has run outside your machine; add a new one.
- `migrate dev`, `migrate reset`, and `db push` are for local databases only. CI and production run `npx prisma migrate deploy`, which applies pending migrations without resetting anything.
- Run `migrate deploy` as a deploy step before the new version starts, not at application boot on every replica.

## Expand and contract

A rename, a type change, or a new required column spans separate deploys, because the old version keeps running while the new one rolls out:

1. Expand: add the new column or table, nullable or with a default.
2. Backfill it, and have the code write both shapes.
3. Switch reads to the new shape.
4. Contract: make it required, and drop the old column in a later migration.

Never add a required column without a default to a table that has rows, or drop a column the running version still reads.

## Verify

- `npx prisma migrate status` shows no pending or failed migrations.
- The e2e suite runs against a test database built with `migrate deploy` (see `tests`).

Adapted in part from [nestjs-best-practices](https://github.com/IsaacHatilima/agent-nestjs-skills/tree/main/skills/nestjs-best-practices) (MIT).
