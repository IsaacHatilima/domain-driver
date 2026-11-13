import * as fs from 'fs';
import * as path from 'path';
import { assertLayer, componentDir, layerDir } from '../stack/registry';
import { RenderContext } from '../templates/context';
import { ContainerWiring, renderContainer } from '../templates/frontend/container';
import { fileExists, writeFileSafe } from '../utils/fs';
import { ensureLayerDir, requireFeature } from './resolve';

const HOOK_FILE = /^(.+)\.hook\.tsx?$/;

function listHookPath(ctx: RenderContext, entity: string): string {
    return `${layerDir(ctx.profile, 'hook')}/List${entity}.hook.ts`;
}

function componentPath(ctx: RenderContext, entity: string): string {
    return `${componentDir(ctx.profile, 'client')}/${entity}.tsx`;
}

function wiringFor(ctx: RenderContext, entity: string): ContainerWiring {
    const exists = (relative: string): boolean => fileExists(path.join(ctx.featureDir, relative));
    return { listHook: exists(listHookPath(ctx, entity)), component: exists(componentPath(ctx, entity)) };
}

/** The hooks the feature already has, as the names a container calls. */
function existingHooks(ctx: RenderContext): readonly string[] {
    const dir = path.join(ctx.featureDir, layerDir(ctx.profile, 'hook'));
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .map((file) => HOOK_FILE.exec(file)?.[1])
        .filter((name): name is string => name !== undefined)
        .map((name) => `use${name}`)
        .sort();
}

function hintWiring(ctx: RenderContext, containerName: string, entity: string, wiring: ContainerWiring): void {
    if (!wiring.listHook) {
        const hooks = existingHooks(ctx);
        const next =
            hooks.length > 0
                ? `Call one of the feature's hooks in it: ${hooks.join(', ')}.`
                : `Generate the hooks with: domain-driver make:hook ${ctx.feature}/<Entity>`;
        console.log(`ℹ️  ${listHookPath(ctx, entity)} not found, so ${containerName} calls no hook yet. ${next}`);
        return;
    }
    if (!wiring.component) {
        console.log(
            `ℹ️  ${componentPath(ctx, entity)} not found, so ${containerName} renders each record's id. Run: domain-driver make:component ${ctx.feature}/${entity}`
        );
    }
}

/**
 * A container lists `<Entity>` records through `useList<Entity>`, where the entity is the name
 * without `Container`. A name that is not an entity with a List hook, such as
 * `ProjectDetailContainer`, gets a container that calls no hook rather than an import of a hook
 * that does not exist, and the hint names the hooks the feature has.
 */
export function makeContainer(feature: string, name: string, pascalName?: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'container', 'make:container');

    const filePath = path.join(ensureLayerDir(ctx, 'container'), `${name}.tsx`);
    if (fileExists(filePath)) {
        throw new Error(`Container "${name}" already exists at ${filePath}`);
    }

    const entity = pascalName ?? name.replace(/Container$/, '');
    const wiring = wiringFor(ctx, entity);
    writeFileSafe(filePath, renderContainer(ctx, name, entity, filePath, wiring));
    console.log(`✅ Container "${name}" created at ${filePath}`);
    hintWiring(ctx, name, entity, wiring);
}
