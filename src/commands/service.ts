import { standardActions } from '../templates/actions';
import { renderService } from '../templates/service';
import { assertLayer } from '../stack/registry';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeSpecFiles } from './write';

/**
 * Services exist only behind the API. The browser reaches them through the hook,
 * which calls the endpoint directly, so there is no client-side counterpart.
 */
export function makeService(feature: string, name: string): boolean {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'serverService', 'make:service');
    const dir = ensureLayerDir(ctx, 'serverService');
    const written = writeSpecFiles(dir, standardActions(name), 'service', (spec, filePath) =>
        renderService(ctx, spec, name, filePath)
    );

    if (written === 0) return false;
    console.log(`✅ Services for "${name}" created at ${dir}`);
    return true;
}
