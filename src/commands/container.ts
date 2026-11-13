import * as fs from 'fs';
import * as path from 'path';
import { assertLayer, componentDir, layerDir } from '../stack/registry';
import { Layer } from '../stack/types';
import { RenderContext } from '../templates/context';
import { ContainerWiring, renderContainer } from '../templates/frontend/container';
import { renderServerContainer, ServerContainerWiring } from '../templates/frontend/server-container';
import { fileExists, writeFileSafe } from '../utils/fs';
import { ensureLayerDir, requireFeature } from './resolve';

const HOOK_FILE = /^(.+)\.hook\.tsx?$/;
const SERVICE_FILE = /^(.+)\.service\.ts$/;

function listHookPath(ctx: RenderContext, entity: string): string {
    return `${layerDir(ctx.profile, 'hook')}/List${entity}.hook.ts`;
}

function listServicePath(ctx: RenderContext, entity: string): string {
    return `${layerDir(ctx.profile, 'serverService')}/List${entity}.service.ts`;
}

function componentPath(ctx: RenderContext, entity: string): string {
    return `${componentDir(ctx.profile, 'client')}/${entity}.tsx`;
}

function existsInFeature(ctx: RenderContext, relative: string): boolean {
    return fileExists(path.join(ctx.featureDir, relative));
}

function wiringFor(ctx: RenderContext, entity: string): ContainerWiring {
    return {
        listHook: existsInFeature(ctx, listHookPath(ctx, entity)),
        component: existsInFeature(ctx, componentPath(ctx, entity)),
    };
}

function serverWiringFor(ctx: RenderContext, entity: string): ServerContainerWiring {
    return {
        listService: existsInFeature(ctx, listServicePath(ctx, entity)),
        component: existsInFeature(ctx, componentPath(ctx, entity)),
    };
}

/** The names a container would call from one layer folder: hook names, or service classes. */
function existingNames(ctx: RenderContext, layer: Layer, pattern: RegExp, name: (base: string) => string): readonly string[] {
    const dir = path.join(ctx.featureDir, layerDir(ctx.profile, layer));
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .map((file) => pattern.exec(file)?.[1])
        .filter((base): base is string => base !== undefined)
        .map(name)
        .sort();
}

function hintComponent(ctx: RenderContext, containerName: string, entity: string): void {
    console.log(
        `ℹ️  ${componentPath(ctx, entity)} not found, so ${containerName} renders each record's id. Run: domain-driver make:component ${ctx.feature}/${entity}`
    );
}

function hintWiring(ctx: RenderContext, containerName: string, entity: string, wiring: ContainerWiring): void {
    if (!wiring.listHook) {
        const hooks = existingNames(ctx, 'hook', HOOK_FILE, (base) => `use${base}`);
        const next =
            hooks.length > 0
                ? `Call one of the feature's hooks in it: ${hooks.join(', ')}.`
                : `Generate the hooks with: domain-driver make:hook ${ctx.feature}/<Entity>`;
        console.log(`ℹ️  ${listHookPath(ctx, entity)} not found, so ${containerName} calls no hook yet. ${next}`);
        return;
    }
    if (!wiring.component) hintComponent(ctx, containerName, entity);
}

function hintServerWiring(ctx: RenderContext, containerName: string, entity: string, wiring: ServerContainerWiring): void {
    if (!wiring.listService) {
        const services = existingNames(ctx, 'serverService', SERVICE_FILE, (base) => `${base}Service`);
        const next =
            services.length > 0
                ? `Call one of the feature's services in it: ${services.join(', ')}.`
                : `Generate the services with: domain-driver make:service ${ctx.feature}/<Entity>`;
        console.log(`ℹ️  ${listServicePath(ctx, entity)} not found, so ${containerName} calls no service yet. ${next}`);
        return;
    }
    if (!wiring.component) hintComponent(ctx, containerName, entity);
}

/**
 * On a Server Actions stack a container is an async Server Component that reads through the List
 * service, unless the feature is served by route handlers: one that has the List fetch hook keeps
 * the client container over it.
 */
function readsOnServer(ctx: RenderContext, entity: string): boolean {
    return ctx.profile.serverActions && !existsInFeature(ctx, listHookPath(ctx, entity));
}

function writeContainer(ctx: RenderContext, name: string, entity: string, filePath: string): void {
    if (readsOnServer(ctx, entity)) {
        const wiring = serverWiringFor(ctx, entity);
        writeFileSafe(filePath, renderServerContainer(ctx, name, entity, filePath, wiring));
        console.log(`✅ Container "${name}" created at ${filePath}`);
        hintServerWiring(ctx, name, entity, wiring);
        return;
    }
    const wiring = wiringFor(ctx, entity);
    writeFileSafe(filePath, renderContainer(ctx, name, entity, filePath, wiring));
    console.log(`✅ Container "${name}" created at ${filePath}`);
    hintWiring(ctx, name, entity, wiring);
}

/**
 * A container lists `<Entity>` records, where the entity is the name without `Container`: through
 * `useList<Entity>`, or on a Server Actions stack through `List<Entity>Service`. A name that is not
 * an entity with that hook or service, such as `ProjectDetailContainer`, gets a container that calls
 * neither rather than an import of a file that does not exist, and the hint names what the feature has.
 */
export function makeContainer(feature: string, name: string, pascalName?: string): void {
    const ctx = requireFeature(feature);
    assertLayer(ctx.profile, 'container', 'make:container');

    const filePath = path.join(ensureLayerDir(ctx, 'container'), `${name}.tsx`);
    if (fileExists(filePath)) {
        throw new Error(`Container "${name}" already exists at ${filePath}`);
    }

    const entity = pascalName ?? name.replace(/Container$/, '');
    writeContainer(ctx, name, entity, filePath);
}
