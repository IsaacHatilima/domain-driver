import { assertLayer } from '../stack/registry';
import { standardActions } from '../templates/actions';
import { hintReactQuery } from './hints';
import { ensureQueryKeys, hookRenderer } from './hook-renderer';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeSpecFiles } from './write';

const OLD_HOOK_NAME_PATTERN = /^use[A-Z]/;

function rejectOldHookName(feature: string, entity: string): void {
    if (!OLD_HOOK_NAME_PATTERN.test(entity)) return;
    const suggestedEntity = entity.slice('use'.length);
    throw new Error(
        `make:hook now takes the entity, not the hook name — try make:hook ${feature}/${suggestedEntity}.`
    );
}

export function makeHook(feature: string, entity: string): boolean {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'hook', 'make:hook');
    rejectOldHookName(feature, entity);

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
