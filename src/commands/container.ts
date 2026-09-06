import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { renderContainer } from '../templates/frontend/container';
import { fileExists, writeFileSafe } from '../utils/fs';
import { ensureLayerDir, requireFeature } from './resolve';

export function makeContainer(feature: string, name: string, pascalName?: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'container', 'make:container');

    const filePath = path.join(ensureLayerDir(ctx, 'container'), `${name}.tsx`);
    if (fileExists(filePath)) {
        throw new Error(`Container "${name}" already exists at ${filePath}`);
    }

    const entity = pascalName ?? name.replace(/Container$/, '');
    writeFileSafe(filePath, renderContainer(ctx, name, entity, filePath));
    console.log(`✅ Container "${name}" created at ${filePath}`);
}
