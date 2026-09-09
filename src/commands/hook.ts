import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { standardActions } from '../templates/actions';
import { renderHook } from '../templates/frontend/hook';
import { renderQueryHook } from '../templates/frontend/query-hook';
import { renderQueryKeys } from '../templates/frontend/query-keys';
import { hintReactQuery } from './hints';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeIfAbsent, writeSpecFiles } from './write';

export function makeHook(feature: string, entity: string): boolean {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'hook', 'make:hook');

    const dir = ensureLayerDir(ctx, 'hook');
    if (ctx.profile.queryHooks) {
        writeIfAbsent(path.join(dir, `${ctx.feature}.keys.ts`), () => renderQueryKeys(ctx.feature));
    }
    const render = ctx.profile.queryHooks ? renderQueryHook : renderHook;
    const written = writeSpecFiles(dir, standardActions(entity), 'hook', (spec, filePath) =>
        render(ctx, spec, entity, filePath)
    );
    if (written > 0) {
        console.log(`✅ Hooks for "${entity}" created at ${dir}`);
        hintReactQuery(ctx.profile);
    }
    return written > 0;
}
