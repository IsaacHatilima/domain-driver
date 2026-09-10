import * as path from 'path';
import { ActionSpec } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { renderHook } from '../templates/frontend/hook';
import { renderQueryHook } from '../templates/frontend/query-hook';
import { renderQueryKeys } from '../templates/frontend/query-keys';
import { fileExists, writeFileSafe } from '../utils/fs';

export type HookRenderer = (ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string) => string;

/**
 * Picks the hook template for the profile: TanStack Query hooks where the profile supports
 * them, the plain useState/useEffect hook otherwise.
 */
export function hookRenderer(ctx: RenderContext): HookRenderer {
    return ctx.profile.queryHooks ? renderQueryHook : renderHook;
}

/**
 * Ensures the shared `<feature>.keys.ts` module exists for query-hook profiles. Unlike
 * `writeIfAbsent`, this never warns: the keys file is deliberately shared across every hook
 * in the feature, so every `make:action`/`make:hook` call re-checking it is expected, not a
 * skipped write worth flagging.
 */
export function ensureQueryKeys(ctx: RenderContext, dir: string): void {
    if (!ctx.profile.queryHooks) return;
    const keysFile = path.join(dir, `${ctx.feature}.keys.ts`);
    if (fileExists(keysFile)) return;
    writeFileSafe(keysFile, renderQueryKeys(ctx.feature));
}
