import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { renderTypes } from '../templates/shared/types';
import { ensureEntitySchema } from './entity';
import { ensureLayerDir, openFeature } from './resolve';
import { writeIfAbsent } from './write';

/** The types file infers the entity from its schema, so the schema is written first when missing. */
export function makeTypes(feature: string, name: string): void {
    const ctx = openFeature(feature, 'make:types');
    assertLayer(ctx.profile, 'types', 'make:types');

    ensureEntitySchema(ctx, name);
    const filePath = path.join(ensureLayerDir(ctx, 'types'), `${name}.types.ts`);
    if (writeIfAbsent(filePath, () => renderTypes(ctx, name, filePath))) {
        console.log(`✅ Types for "${name}" created at ${filePath}`);
    }
}
