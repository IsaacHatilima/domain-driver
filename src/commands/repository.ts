import { standardActions } from '../templates/actions';
import { renderServerRepository } from '../templates/backend/server-repository';
import { assertLayer } from '../stack/registry';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeSpecFiles } from './write';

/**
 * Repositories exist only behind the API, where the data source is. Nothing in the
 * browser needs one: the hook calls the endpoint and the service behind it owns the
 * repository.
 */
export function makeRepository(feature: string, name: string): boolean {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'serverRepository', 'make:repository');
    const dir = ensureLayerDir(ctx, 'serverRepository');
    const written = writeSpecFiles(dir, standardActions(name), 'repository', (spec, filePath) =>
        renderServerRepository(ctx, spec, name, filePath)
    );

    if (written === 0) return false;
    console.log(`✅ Repositories for "${name}" created at ${dir}`);
    return true;
}
