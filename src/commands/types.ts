import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { renderTypes } from '../templates/shared/types';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeIfAbsent } from './write';

export function makeTypes(feature: string, name: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'types', 'make:types');

    const filePath = path.join(ensureLayerDir(ctx, 'types'), `${name}.types.ts`);
    if (writeIfAbsent(filePath, () => renderTypes(name))) {
        console.log(`✅ Types for "${name}" created at ${filePath}`);
    }
}
