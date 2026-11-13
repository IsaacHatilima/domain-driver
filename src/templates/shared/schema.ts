export function renderSchema(name: string, label: string): string {
    return `import { z } from 'zod';

export const ${name}Schema = z.object({
  // add ${label} fields here
});

export type ${name} = z.infer<typeof ${name}Schema>;
`;
}

/**
 * The record as the API returns it. The entity type is inferred from it in `types/`, and hooks
 * parse every response with it, so there is one description of the record rather than an
 * interface that drifts from what the API sends.
 */
export function renderEntitySchema(entity: string): string {
    return `import { z } from 'zod';

export const ${entity}Schema = z.object({
  id: z.string(),
  // add ${entity} fields here
  createdAt: z.string(),
  updatedAt: z.string(),
});
`;
}
