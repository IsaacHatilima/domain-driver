import * as path from 'path';
import { hasLayer } from '../stack/registry';
import { RenderContext } from '../templates/context';
import { renderPage } from '../templates/frontend/page';
import { renderModule } from '../templates/nest/module';
import { fileExists, mkdirSafe, writeFileSafe } from '../utils/fs';
import { toPascalCase } from '../utils/naming';
import { makeComponent } from './component';
import { makeContainer } from './container';
import { makeController } from './controller';
import { makeHook } from './hook';
import { makeRepository } from './repository';
import { resolveFeature } from './resolve';
import { makeSchema } from './schema';
import { makeService } from './service';
import { makeTypes } from './types';

export async function makeFeature(name: string, all: boolean = false, entityName?: string): Promise<void> {
    const ctx = resolveFeature(name);

    if (fileExists(ctx.featureDir)) {
        throw new Error(`Feature "${name}" already exists at ${ctx.featureDir}`);
    }

    const entity = entityName ?? toPascalCase(name);
    createFolders(ctx, all);
    console.log(`✅ Feature "${name}" scaffolded at ${ctx.featureDir}`);

    if (all) scaffoldLayers(ctx, entity);
    writeEntryFile(ctx, entity, all);

    if (all) console.log(`✅ All files scaffolded for "${name}"`);
}

function createFolders(ctx: RenderContext, all: boolean): void {
    for (const folder of ctx.profile.folders) {
        const dir = path.join(ctx.featureDir, folder);
        mkdirSafe(dir);
        if (!all) writeFileSafe(path.join(dir, '.gitkeep'), '');
    }
}

function scaffoldLayers(ctx: RenderContext, entity: string): void {
    const { feature, profile } = ctx;
    if (hasLayer(profile, 'types')) makeTypes(feature, entity);
    if (hasLayer(profile, 'schema')) makeSchema(feature, entity);
    if (hasLayer(profile, 'serverRepository')) makeRepository(feature, entity, 'server');
    if (hasLayer(profile, 'serverService')) makeService(feature, entity, 'server');
    if (hasLayer(profile, 'controller')) makeController(feature, entity);
    if (hasLayer(profile, 'clientRepository')) makeRepository(feature, entity, 'client');
    if (hasLayer(profile, 'clientService')) makeService(feature, entity, 'client');
    if (hasLayer(profile, 'hook')) makeHook(feature, entity);
    if (hasLayer(profile, 'component')) makeComponent(feature, entity, 'client');
    if (hasLayer(profile, 'container')) makeContainer(feature, `${entity}Container`, entity);
}

function writeEntryFile(ctx: RenderContext, entity: string, all: boolean): void {
    if (hasLayer(ctx.profile, 'page')) {
        const filePath = path.join(ctx.featureDir, 'page.tsx');
        writeFileSafe(filePath, renderPage(ctx, entity, filePath, all));
    }
    if (hasLayer(ctx.profile, 'module')) {
        const filePath = path.join(ctx.featureDir, `${ctx.feature}.module.ts`);
        writeFileSafe(filePath, renderModule(ctx, entity, filePath, all));
    }
}
