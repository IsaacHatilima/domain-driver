---
name: nest-dtos
description: "Use when creating or changing a NestJS request DTO, Zod input schema, query or path validation, or partial-update contract, or when deciding what an endpoint returns and how a Prisma result becomes that response."
---

# DTOs

Applies to: `src/**/schemas/*.schema.ts`, `src/**/dto/*.dto.ts`, `src/**/types/*.types.ts`, `src/**/types/*.mapper.ts`. Project guidance and existing conventions win over these defaults.

Register `{ provide: APP_PIPE, useClass: ZodValidationPipe }` from `nestjs-zod` once in `AppModule`, so e2e apps validate the same way. Don't add per-route pipes or class-validator. nestjs-zod 5.5 still declares Nest 10–11 peers; on Nest 12, allow it through the package manager's peer rules.

## Input DTOs

- `schemas/CreateProject.schema.ts` exports `CreateProjectSchema` and its inferred type, `CreateProject`. `dto/CreateProject.dto.ts` derives the class with `createZodDto`. domain-driver writes both (`make:schema`, or `make:action --with-input`).
- Controllers type `@Body()` and `@Query()` with the DTO class. Actions take the inferred type.
- Use `z.strictObject()`, so unknown keys fail with a 400. Plain `z.object()` silently drops them.
- Normalize once, here: trim, lower-case emails, and turn blank optional strings into `null`. Passwords and tokens pass through untouched. Use Zod transforms in the schema or a `z.preprocess()` normalizer in the DTO, as the project does.
- Query and path values arrive as strings. Use `z.coerce.number()` and `z.stringbool()`, never `z.coerce.boolean()`, which turns `"false"` into `true`. Cap every `limit` with `.max()`.
- Reuse shared field schemas, such as email and password. Cross-field rules go in `.refine()`; checks that need the database belong to the action.

## Partial updates

Build the update schema with `.partial()` and a `.refine()` that rejects an empty body. An omitted field stays `undefined`, which Prisma leaves untouched, while `null` clears the column. Allow `.nullable()` only on fields that may be cleared.

## Output DTOs

- Endpoints return an output DTO, never a Prisma row, an input DTO, or `any`. Rows carry columns such as password hashes, and every new column would leak.
- Replace the interface domain-driver generates in `types/Project.types.ts` with a Zod response schema and its inferred type. The same schema documents the route in OpenAPI.
- `types/Project.mapper.ts` exports the `select` the response needs and a mapper that copies each field. Repositories query with that select (see `database`), so the mapper's input type is `Prisma.ProjectGetPayload` of it.
- Mappers turn dates into ISO strings and never query.

## Example

```ts
// schemas/CreateProject.schema.ts
export const CreateProjectSchema = z.strictObject({ name: z.string().trim().min(1).max(120) });
export type CreateProject = z.infer<typeof CreateProjectSchema>;

// dto/CreateProject.dto.ts
export class CreateProjectDto extends createZodDto(CreateProjectSchema) {}

// types/Project.types.ts
export const ProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  taskCount: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

// types/Project.mapper.ts
export const projectSelect = {
  id: true,
  name: true,
  createdAt: true,
  _count: { select: { tasks: true } },
} satisfies Prisma.ProjectSelect;

export type ProjectRecord = Prisma.ProjectGetPayload<{ select: typeof projectSelect }>;

export function toProject(project: ProjectRecord): Project {
  return {
    id: project.id,
    name: project.name,
    taskCount: project._count.tasks,
    createdAt: project.createdAt.toISOString(),
  };
}
```

`createZodDto` comes from `nestjs-zod`, and `Prisma` from the generated client.

## Verify

Schema tests cover normalization, rejected unknown keys, coerced query values, and omitted versus `null`. E2e tests check that responses carry no private fields.
