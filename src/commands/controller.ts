import * as path from 'path';
import { assertLayer } from '../stack/registry';
import { standardActions } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { isWrite } from '../templates/controllers/next-server-action';
import { renderCollectionRoute, renderItemRoute } from '../templates/controllers/next-route';
import { renderNodeRoutes } from '../templates/controllers/node';
import { mkdirSafe } from '../utils/fs';
import { apiRouteDir } from '../utils/paths';
import { controllerRenderer, controllerSuffix } from './controller-renderer';
import { hintRouteIgnored } from './hints';
import { hintNestRoutes } from './nest-routes';
import { ensureLayerDir, requireFeature } from './resolve';
import { DeliveryOptions, hintCallerCheck, usesServerActions, writeServerActions } from './server-actions';
import { writeSpecFiles, writeIfAbsent } from './write';

export function makeController(feature: string, name: string, options: DeliveryOptions = {}): boolean {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'controller', 'make:controller');
    hintRouteIgnored(ctx.profile, options.route);

    if (usesServerActions(ctx, options)) {
        return writeStandardServerActions(ctx, name);
    }
    if (ctx.profile.name === 'next-fullstack') {
        return writeNextRoutes(ctx, name);
    }

    const dir = ensureLayerDir(ctx, 'controller');
    const render = controllerRenderer(ctx.profile.name);
    const suffix = controllerSuffix(ctx.profile.name);
    const written = writeSpecFiles(dir, standardActions(name), suffix, (spec, filePath) =>
        render(ctx, spec, name, filePath)
    );
    const label = ctx.profile.name === 'tanstack-start' ? 'Server functions' : 'Controllers';
    if (written > 0) {
        console.log(`✅ ${label} for "${name}" created at ${dir}`);
        hintNestRoutes(ctx, standardActions(name), name);
    }

    const wroteRoutes = ctx.profile.name === 'node' ? writeNodeRoutes(ctx, name) : false;
    return written > 0 || wroteRoutes;
}

function writeNodeRoutes(ctx: RenderContext, name: string): boolean {
    const filePath = path.join(ctx.featureDir, `${ctx.feature}.routes.ts`);
    const content = renderNodeRoutes(ctx, name, filePath);

    if (content === null) {
        console.log('ℹ️  No HTTP framework detected, generating framework-agnostic controllers.');
        return false;
    }
    const wrote = writeIfAbsent(filePath, () => content);
    if (wrote) console.log(`✅ Routes for "${name}" created at ${filePath}`);
    return wrote;
}

/** Create, Update and Delete become Server Actions. List and Show are read by a Server Component. */
function writeStandardServerActions(ctx: RenderContext, name: string): boolean {
    const written = writeServerActions(ctx, standardActions(name).filter(isWrite), name);
    if (written.length === 0) return false;
    console.log(`✅ Server Actions for "${name}" created at ${path.dirname(written[0])}`);
    hintCallerCheck(written);
    return true;
}

function writeNextRoutes(ctx: RenderContext, name: string): boolean {
    const collectionDir = apiRouteDir(ctx.stack, ctx.feature);
    const itemDir = path.join(collectionDir, '[id]');
    mkdirSafe(itemDir);

    const collectionFile = path.join(collectionDir, 'route.ts');
    const itemFile = path.join(itemDir, 'route.ts');
    const wroteCollection = writeIfAbsent(collectionFile, () => renderCollectionRoute(ctx, name, collectionFile));
    const wroteItem = writeIfAbsent(itemFile, () => renderItemRoute(ctx, name, itemFile));
    const wroteAny = wroteCollection || wroteItem;
    if (wroteAny) console.log(`✅ Route handlers for "${name}" created at ${collectionDir}`);
    return wroteAny;
}
