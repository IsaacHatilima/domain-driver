import { assertLayer } from '../stack/registry';
import { standardActions } from '../templates/actions';
import { renderHook } from '../templates/frontend/hook';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeSpecFiles } from './write';

export function makeHook(feature: string, entity: string): boolean {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'hook', 'make:hook');

    const dir = ensureLayerDir(ctx, 'hook');
    const written = writeSpecFiles(dir, standardActions(entity), 'hook', (spec, filePath) =>
        renderHook(ctx, spec, entity, filePath)
    );
    if (written > 0) console.log(`✅ Hooks for "${entity}" created at ${dir}`);
    return written > 0;
}
