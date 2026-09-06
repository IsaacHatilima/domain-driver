import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { renderHook } from '../templates/frontend/hook';
import { fileExists, writeFileSafe } from '../utils/fs';
import { ensureLayerDir, requireFeature } from './resolve';

export function makeHook(feature: string, name: string, pascalName?: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'hook', 'make:hook');

    const filePath = path.join(ensureLayerDir(ctx, 'hook'), `${name}.ts`);
    if (fileExists(filePath)) {
        throw new Error(`Hook "${name}" already exists at ${filePath}`);
    }

    const entity = pascalName ?? name.replace(/^use/, '');
    writeFileSafe(filePath, renderHook(ctx, name, entity, filePath));
    console.log(`✅ Hook "${name}" created at ${filePath}`);
}
