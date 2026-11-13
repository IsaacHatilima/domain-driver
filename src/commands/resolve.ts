import * as path from 'path';
import { detectStack } from '../stack/detect';
import { getProfile, hasLayer, layerDir } from '../stack/registry';
import { Layer } from '../stack/types';
import { createContext, RenderContext } from '../templates/context';
import { fileExists, mkdirSafe } from '../utils/fs';
import { validateFeatureName } from '../utils/naming';

/** The commands whose classes are registered in the feature's own module on a stack that has one. */
const REGISTERING_COMMANDS: ReadonlySet<string> = new Set([
    'make:controller',
    'make:service',
    'make:repository',
    'make:action',
]);

export function resolveFeature(feature: string): RenderContext {
    validateFeatureName(feature);
    const stack = detectStack();
    return createContext(feature, stack, getProfile(stack.stack));
}

/**
 * The make:feature line for this feature, with the flags that chose its stack and root, so running
 * it creates the feature where this command looked rather than under the default root.
 */
export function makeFeatureCommand(ctx: RenderContext): string {
    const flags = [
        ctx.stack.source === 'override' ? `--stack ${ctx.stack.stack}` : null,
        ctx.stack.featureRootSource === 'flag' ? `--root ${ctx.stack.featureRoot}` : null,
    ].filter((flag): flag is string => flag !== null);
    return ['domain-driver', ...flags, 'make:feature', ctx.feature].join(' ');
}

export function requireFeature(feature: string): RenderContext {
    const ctx = resolveFeature(feature);
    if (!fileExists(ctx.featureDir)) {
        throw new Error(`Feature "${feature}" does not exist. Run: ${makeFeatureCommand(ctx)}`);
    }
    return ctx;
}

/**
 * The feature a layer command writes into, whether or not its folder exists yet: the command creates
 * the folders it writes into when it writes (see `ensureFeatureDir`), so a folder that only shares
 * types or schemas, such as a Nest area's `src/projects/shared`, needs no make:feature first.
 *
 * A Nest command that registers classes is the exception. Its classes only work once the feature's
 * module provides them, and make:feature is what writes that module and registers it, but
 * make:feature refuses a folder that exists. Creating the folder would strand the classes, so the
 * command names the make:feature to run first instead.
 */
export function openFeature(feature: string, command: string): RenderContext {
    const ctx = resolveFeature(feature);
    if (fileExists(ctx.featureDir)) return ctx;
    if (REGISTERING_COMMANDS.has(command) && hasLayer(ctx.profile, 'module')) {
        throw new Error(
            `Feature "${feature}" does not exist, and ${command} registers its classes in the feature's module, ` +
                `which make:feature writes and registers. Run first: ${makeFeatureCommand(ctx)}`
        );
    }
    return ctx;
}

/**
 * A folder inside the feature, created with the feature's own folder when this is the first write
 * into it. Creating it here, at the write, rather than when the feature is opened means a command
 * that refuses before writing anything leaves no empty folder behind.
 */
export function ensureFeatureDir(ctx: RenderContext, relative: string): string {
    if (!fileExists(ctx.featureDir)) {
        mkdirSafe(ctx.featureDir);
        console.log(`✅ Feature folder "${ctx.feature}" created at ${ctx.featureDir}`);
    }
    const dir = path.join(ctx.featureDir, relative);
    mkdirSafe(dir);
    return dir;
}

export function ensureLayerDir(ctx: RenderContext, layer: Layer): string {
    return ensureFeatureDir(ctx, layerDir(ctx.profile, layer));
}
