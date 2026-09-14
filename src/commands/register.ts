import * as path from 'path';
import { Entry, applyRegistrations } from '../nest/registration';
import { findRootModule } from '../nest/root-module';
import { ModuleProperty } from '../nest/register';
import { layerDir } from '../stack/registry';
import { Layer } from '../stack/types';
import { ACTIONS } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { fileExists } from '../utils/fs';

interface Kind {
    readonly layer: Layer;
    readonly suffix: string;
    readonly fileSuffix: string;
    readonly property: ModuleProperty;
}

export const KINDS: Readonly<Record<'controller' | 'service' | 'repository', Kind>> = Object.freeze({
    controller: { layer: 'controller', suffix: 'Controller', fileSuffix: 'controller', property: 'controllers' },
    service: { layer: 'serverService', suffix: 'Service', fileSuffix: 'service', property: 'providers' },
    repository: { layer: 'serverRepository', suffix: 'Repository', fileSuffix: 'repository', property: 'providers' },
});

function featureModule(ctx: RenderContext): string {
    return path.join(ctx.featureDir, `${ctx.feature}.module.ts`);
}

function entriesFor(ctx: RenderContext, kind: Kind, names: readonly string[]): Entry[] {
    const dir = path.join(ctx.featureDir, layerDir(ctx.profile, kind.layer));
    return names
        .map((name) => ({
            identifier: `${name}${kind.suffix}`,
            definedIn: path.join(dir, `${name}.${kind.fileSuffix}.ts`),
            property: kind.property,
        }))
        .filter((entry) => fileExists(entry.definedIn));
}

/** Registers generated classes in the feature's own module. Nest is the only stack with one. */
export function registerClasses(
    ctx: RenderContext,
    kind: keyof typeof KINDS,
    actionNames: readonly string[]
): void {
    if (ctx.profile.name !== 'nest') return;
    applyRegistrations(featureModule(ctx), entriesFor(ctx, KINDS[kind], actionNames), ctx.stack.autoRegister);
}

export function standardActionNames(entity: string): readonly string[] {
    return ACTIONS.map((action) => `${action}${entity}`);
}

/**
 * A bespoke action's controller must be declared ahead of Show<Entity>Controller: Nest matches
 * routes in declaration order, and a custom GET path would otherwise be swallowed by `/:id`.
 */
export function registerCustomAction(ctx: RenderContext, action: string, entity: string): void {
    if (ctx.profile.name !== 'nest') return;
    const entries: Entry[] = [
        { ...entriesFor(ctx, KINDS.controller, [action])[0], before: `Show${entity}Controller` },
        entriesFor(ctx, KINDS.service, [action])[0],
        entriesFor(ctx, KINDS.repository, [action])[0],
    ];
    applyRegistrations(featureModule(ctx), entries, ctx.stack.autoRegister);
}

/** Registers the feature's module in the application's root module. */
export function registerFeatureModule(ctx: RenderContext, entity: string): void {
    if (ctx.profile.name !== 'nest') return;
    const moduleFile = featureModule(ctx);
    if (!fileExists(moduleFile)) return;

    const rootModule = findRootModule(process.cwd(), ctx.stack.featureRoot, ctx.stack.rootModule);
    if (rootModule === null) {
        if (!ctx.stack.autoRegister) return;
        console.log(
            `ℹ️  No root module found, so ${entity}Module was not registered. Add it by hand, or name the file with "domainDriver": { "rootModule": "..." } in package.json.`
        );
        return;
    }
    if (path.resolve(rootModule) === path.resolve(moduleFile)) return;

    applyRegistrations(
        rootModule,
        [{ identifier: `${entity}Module`, definedIn: moduleFile, property: 'imports' }],
        ctx.stack.autoRegister
    );
}
