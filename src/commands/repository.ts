import { SideOption } from '../stack/types';
import { ActionSpec, standardActions } from '../templates/actions';
import { renderServerRepository } from '../templates/backend/server-repository';
import { RenderContext } from '../templates/context';
import { renderClientRepository } from '../templates/frontend/client-repository';
import { renderServerFnRepository } from '../templates/frontend/server-fn-repository';
import { ensureLayerDir, requireFeature } from './resolve';
import { REPOSITORY_SIDES, resolveSides } from './sides';
import { writeSpecFiles } from './write';

export type SpecRenderer = (ctx: RenderContext, spec: ActionSpec, entity: string, fromFile: string) => string;

// Selected on the profile name, not on `queryHooks`: the two coincide today but mean different
// things. `queryHooks` picks the hook renderer; this picks whether a server function exists to call.
export function clientRenderer(ctx: RenderContext): SpecRenderer {
    return ctx.profile.name === 'tanstack-start' ? renderServerFnRepository : renderClientRepository;
}

export function makeRepository(feature: string, name: string, side: SideOption = 'both'): boolean {
    const ctx = requireFeature(feature);
    let wroteAny = false;

    for (const current of resolveSides(ctx.profile, side, REPOSITORY_SIDES)) {
        const dir = ensureLayerDir(ctx, REPOSITORY_SIDES[current]);
        const render = current === 'client' ? clientRenderer(ctx) : renderServerRepository;
        const written = writeSpecFiles(dir, standardActions(name), 'repository', (spec, filePath) =>
            render(ctx, spec, name, filePath)
        );
        if (written > 0) {
            console.log(`✅ Repositories (${current}) for "${name}" created at ${dir}`);
            wroteAny = true;
        }
    }
    return wroteAny;
}
