import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { standardActions } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { renderNestController } from '../templates/controllers/nest';
import { renderCollectionRoute, renderItemRoute } from '../templates/controllers/next-route';
import { renderNodeController, renderNodeRoutes } from '../templates/controllers/node';
import { mkdirSafe } from '../utils/fs';
import { apiRouteDir } from '../utils/paths';
import { ensureLayerDir, requireFeature } from './resolve';
import { writeSpecFiles, writeIfAbsent } from './write';

export function makeController(feature: string, name: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'controller', 'make:controller');

    if (ctx.profile.name === 'next-fullstack') {
        writeNextRoutes(ctx, name);
        return;
    }

    const dir = ensureLayerDir(ctx, 'controller');
    const render = ctx.profile.name === 'nest' ? renderNestController : renderNodeController;
    writeSpecFiles(dir, standardActions(name), 'controller', (spec, filePath) =>
        render(ctx, spec, name, filePath)
    );
    console.log(`✅ Controllers for "${name}" created at ${dir}`);

    if (ctx.profile.name === 'node') writeNodeRoutes(ctx, name);
}

function writeNodeRoutes(ctx: RenderContext, name: string): void {
    const filePath = path.join(ctx.featureDir, `${ctx.feature}.routes.ts`);
    const content = renderNodeRoutes(ctx, name, filePath);

    if (content === null) {
        console.log('ℹ️  No HTTP framework detected, generating framework-agnostic controllers.');
        return;
    }
    if (writeIfAbsent(filePath, () => content)) {
        console.log(`✅ Routes for "${name}" created at ${filePath}`);
    }
}

function writeNextRoutes(ctx: RenderContext, name: string): void {
    const collectionDir = apiRouteDir(ctx.stack, ctx.feature);
    const itemDir = path.join(collectionDir, '[id]');
    mkdirSafe(itemDir);

    const collectionFile = path.join(collectionDir, 'route.ts');
    const itemFile = path.join(itemDir, 'route.ts');
    writeIfAbsent(collectionFile, () => renderCollectionRoute(ctx, name, collectionFile));
    writeIfAbsent(itemFile, () => renderItemRoute(ctx, name, itemFile));
    console.log(`✅ Route handlers for "${name}" created at ${collectionDir}`);
}
