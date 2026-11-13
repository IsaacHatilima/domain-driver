/** Where a schema's input comes from: a request body, or the query string of a GET. */
export type InputSource = 'body' | 'query';

/**
 * A query string carries only strings, so a schema for one says how to read a number or a boolean
 * out of it. `z.coerce.boolean()` is named only as the trap: it is `Boolean(value)`, true for "false".
 */
const QUERY_NOTE = `  // They are read from the query string, so every value arrives as a string:
  // use z.coerce.number() for a number, and z.stringbool() for a boolean
  // (z.coerce.boolean() turns any non-empty string, "false" included, into true).
`;

export function renderSchema(name: string, label: string, source: InputSource = 'body'): string {
    const note = source === 'query' ? QUERY_NOTE : '';
    return `import { z } from 'zod';

export const ${name}Schema = z.object({
  // add ${label} fields here
${note}});

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
