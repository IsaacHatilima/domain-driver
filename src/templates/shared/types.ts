import { RenderContext } from '../context';

/** The entity type, inferred from the entity schema rather than kept as a parallel interface. */
export function renderTypes(ctx: RenderContext, entity: string, fromFile: string): string {
    const schemaPath = ctx.importLayer(fromFile, 'schema', `${entity}.schema`);
    return `import type { z } from 'zod';
import type { ${entity}Schema } from '${schemaPath}';

export type ${entity} = z.infer<typeof ${entity}Schema>;
`;
}
