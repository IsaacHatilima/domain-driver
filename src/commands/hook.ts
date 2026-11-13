import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { standardActions } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { fileExists } from '../utils/fs';
import { apiRouteDir } from '../utils/paths';
import { hintMissingEntity } from './entity';
import { hintReactQuery } from './hints';
import { ensureQueryKeys, hookRenderer } from './hook-renderer';
import { ensureLayerDir, openFeature } from './resolve';
import { writeSpecFiles } from './write';

const OLD_HOOK_NAME_PATTERN = /^use[A-Z]/;

function rejectOldHookName(feature: string, entity: string): void {
    if (!OLD_HOOK_NAME_PATTERN.test(entity)) return;
    const suggestedEntity = entity.slice('use'.length);
    throw new Error(
        `make:hook now takes the entity, not the hook name — try make:hook ${feature}/${suggestedEntity}.`
    );
}

/**
 * A Server Actions feature has no API until it is given route handlers, so fetch hooks written into
 * one would call a URL that answers 404.
 */
function hintMissingRoutes(ctx: RenderContext, entity: string): void {
    if (!ctx.profile.serverActions) return;
    if (fileExists(path.join(apiRouteDir(ctx.stack, ctx.feature), 'route.ts'))) return;
    console.log(
        `ℹ️  These hooks fetch /api/${ctx.feature}, which has no route handler yet. Run: domain-driver make:controller ${ctx.feature}/${entity} --route`
    );
}

export function makeHook(feature: string, entity: string): boolean {
    const ctx = openFeature(feature, 'make:hook');
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
        hintMissingEntity(ctx, entity);
        hintReactQuery(ctx.profile);
        hintMissingRoutes(ctx, entity);
    }
    return written > 0;
}
