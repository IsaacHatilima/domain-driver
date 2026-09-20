import { Layer, StackName, StackProfile } from './types';
import { nextFullstack } from './profiles/next-fullstack';
import { nextFrontend } from './profiles/next-frontend';
import { react } from './profiles/react';
import { node } from './profiles/node';
import { nest } from './profiles/nest';
import { tanstackStart } from './profiles/tanstack-start';

const PROFILES: Readonly<Record<StackName, StackProfile>> = Object.freeze({
    'next-fullstack': nextFullstack,
    'next-frontend': nextFrontend,
    react,
    node,
    nest,
    'tanstack-start': tanstackStart,
});

const LAYER_COMMANDS: Readonly<Partial<Record<Layer, string>>> = Object.freeze({
    component: 'make:component',
    container: 'make:container',
    hook: 'make:hook',
    serverService: 'make:service',
    serverRepository: 'make:repository',
    controller: 'make:controller',
    schema: 'make:schema',
    dto: 'make:schema',
    types: 'make:types',
});

export function getProfile(stack: StackName): StackProfile {
    return PROFILES[stack];
}

export function hasLayer(profile: StackProfile, layer: Layer): boolean {
    return profile.layers.includes(layer);
}

export function layerDir(profile: StackProfile, layer: Layer): string {
    const dir = profile.layerDirs[layer];
    if (dir === undefined) {
        throw new Error(`Layer "${layer}" has no directory in the ${profile.name} profile.`);
    }
    return dir;
}

export function componentDir(profile: StackProfile, type: 'client' | 'server'): string {
    const base = layerDir(profile, 'component');
    return profile.serverComponents ? `${base}/${type}` : base;
}

export function availableCommands(profile: StackProfile): readonly string[] {
    const commands = profile.layers
        .map((layer) => LAYER_COMMANDS[layer])
        .filter((command): command is string => command !== undefined);
    return [...new Set(commands)];
}

/**
 * Extra guidance for the two refusals people hit most, so the error explains the
 * architecture rather than just listing what is available.
 */
function hintFor(profile: StackProfile, layer: Layer): string {
    if (profile.name === 'next-frontend' && layer === 'controller') {
        return ' Create an app/api directory or pass --stack next-fullstack to enable route handlers.';
    }
    if (layer === 'serverService' || layer === 'serverRepository') {
        return ` Services and repositories live behind the API, and the ${profile.name} stack has no server side. Its hooks call the API directly.`;
    }
    return '';
}

export function assertLayer(profile: StackProfile, layer: Layer, command: string): void {
    if (hasLayer(profile, layer)) return;
    const escapeHatch = hintFor(profile, layer);
    throw new Error(
        `${command} is not available for the ${profile.name} stack. Available: ${availableCommands(profile).join(', ')}.${escapeHatch}`
    );
}
