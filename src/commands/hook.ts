import { assertLayer } from '../stack/registry';
import { standardActions } from '../templates/actions';
import { hintReactQuery } from './hints';
import { ensureQueryKeys, hookRenderer } from './hook-renderer';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeSpecFiles } from './write';

export function makeHook(feature: string, entity: string): boolean {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'hook', 'make:hook');

    const dir = ensureLayerDir(ctx, 'hook');
    ensureQueryKeys(ctx, dir);
    const render = hookRenderer(ctx);
    const written = writeSpecFiles(dir, standardActions(entity), 'hook', (spec, filePath) =>
        render(ctx, spec, entity, filePath)
    );
    if (written > 0) {
        console.log(`✅ Hooks for "${entity}" created at ${dir}`);
        hintReactQuery(ctx.profile);
    }
    return written > 0;
}
