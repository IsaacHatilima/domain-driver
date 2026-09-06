import { SideOption } from '../stack/types';
import { ACTIONS } from '../templates/actions';
import { renderService } from '../templates/service';
import { ensureLayerDir, requireFeature } from './resolve';
import { resolveSides, SERVICE_SIDES } from './sides';
import { writeActionFiles } from './write';

export function makeService(feature: string, name: string, side: SideOption = 'both'): void {
    const ctx = requireFeature(feature);

    for (const current of resolveSides(ctx.profile, side, SERVICE_SIDES)) {
        const dir = ensureLayerDir(ctx, SERVICE_SIDES[current]);
        writeActionFiles(dir, name, 'service', ACTIONS, (action, filePath) =>
            renderService(ctx, action, name, filePath, current)
        );
        console.log(`✅ Services (${current}) for "${name}" created at ${dir}`);
    }
}
