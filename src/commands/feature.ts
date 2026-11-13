import * as path from 'path';
import { featureFolders, hasLayer } from '../stack/registry';
import { RenderContext } from '../templates/context';
import { renderPage } from '../templates/frontend/page';
import { renderRoute } from '../templates/frontend/route';
import { renderModule } from '../templates/nest/module';
import { fileExists, mkdirSafe, PLACEHOLDER, writeFileSafe } from '../utils/fs';
import { toPascalCase } from '../utils/naming';
import { makeComponent } from './component';
import { makeContainer } from './container';
import { makeController } from './controller';
import { hintRouteIgnored } from './hints';
import { makeHook } from './hook';
import { makeRepository } from './repository';
import { registerFeatureModule } from './register';
import { resolveFeature } from './resolve';
import { makeSchema } from './schema';
import { DeliveryOptions, usesServerActions } from './server-actions';
import { makeService } from './service';
import { makeTypes } from './types';

export async function makeFeature(
    name: string,
    all: boolean = false,
    entityName?: string,
    options: DeliveryOptions = {}
): Promise<void> {
    const ctx = resolveFeature(name);

    if (fileExists(ctx.featureDir)) {
        throw new Error(`Feature "${name}" already exists at ${ctx.featureDir}`);
    }
    hintRouteIgnored(ctx.profile, options.route);

    const entity = entityName ?? toPascalCase(name);
    createFolders(ctx, all, options);
    console.log(`✅ Feature "${name}" scaffolded at ${ctx.featureDir}`);

    if (all) scaffoldLayers(ctx, entity, options);
    writeEntryFile(ctx, entity, all);
    registerFeatureModule(ctx);

    if (all) console.log(`✅ All files scaffolded for "${name}"`);
}

function createFolders(ctx: RenderContext, all: boolean, options: DeliveryOptions): void {
    for (const folder of featureFolders(ctx.profile, options.route === true)) {
        const dir = path.join(ctx.featureDir, folder);
        mkdirSafe(dir);
        if (!all) writeFileSafe(path.join(dir, PLACEHOLDER), '');
    }
}

/**
 * On a Server Actions stack the writes become actions and the reads go through the Server Component
 * container, so no fetch hook is generated unless the feature is served by route handlers.
 */
function scaffoldLayers(ctx: RenderContext, entity: string, options: DeliveryOptions): void {
    const { feature, profile } = ctx;
    if (hasLayer(profile, 'types')) makeTypes(feature, entity);
    if (hasLayer(profile, 'schema')) makeSchema(feature, entity);
    if (hasLayer(profile, 'serverRepository')) makeRepository(feature, entity);
    if (hasLayer(profile, 'serverService')) makeService(feature, entity);
    if (hasLayer(profile, 'controller')) makeController(feature, entity, options);
    if (hasLayer(profile, 'hook') && !usesServerActions(ctx, options)) makeHook(feature, entity);
    if (hasLayer(profile, 'component')) makeComponent(feature, entity, 'client');
    if (hasLayer(profile, 'container')) makeContainer(feature, `${entity}Container`, entity);
}

function writeEntryFile(ctx: RenderContext, entity: string, all: boolean): void {
    if (hasLayer(ctx.profile, 'page')) {
        const isRoute = ctx.profile.name === 'tanstack-start';
        const filePath = path.join(ctx.featureDir, isRoute ? 'index.tsx' : 'page.tsx');
        const content = isRoute
            ? renderRoute(ctx, entity, filePath, all)
            : renderPage(ctx, entity, filePath, all);
        writeFileSafe(filePath, content);
    }
    if (hasLayer(ctx.profile, 'module')) {
        const filePath = path.join(ctx.featureDir, `${ctx.feature}.module.ts`);
        writeFileSafe(filePath, renderModule(ctx, entity, filePath, all));
    }
}
