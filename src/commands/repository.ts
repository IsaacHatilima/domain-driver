import { SideOption } from '../stack/types';
import { standardActions } from '../templates/actions';
import { renderServerRepository } from '../templates/backend/server-repository';
import { renderClientRepository } from '../templates/frontend/client-repository';
import { ensureLayerDir, requireFeature } from './resolve';
import { REPOSITORY_SIDES, resolveSides } from './sides';
import { writeSpecFiles } from './write';

export function makeRepository(feature: string, name: string, side: SideOption = 'both'): void {
    const ctx = requireFeature(feature);

    for (const current of resolveSides(ctx.profile, side, REPOSITORY_SIDES)) {
        const dir = ensureLayerDir(ctx, REPOSITORY_SIDES[current]);
        const render = current === 'client' ? renderClientRepository : renderServerRepository;
        writeSpecFiles(dir, standardActions(name), 'repository', (spec, filePath) =>
            render(ctx, spec, name, filePath)
        );
        console.log(`✅ Repositories (${current}) for "${name}" created at ${dir}`);
    }
}
