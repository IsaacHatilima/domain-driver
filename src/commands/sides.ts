import { assertLayer, hasLayer } from '../stack/registry';
import { Layer, Side, SideOption, StackProfile } from '../stack/types';

export interface SideSpec {
    readonly client: Layer;
    readonly server: Layer;
    readonly command: string;
    readonly noun: string;
}

export const SERVICE_SIDES: SideSpec = Object.freeze({
    client: 'clientService',
    server: 'serverService',
    command: 'make:service',
    noun: 'services',
});

export const REPOSITORY_SIDES: SideSpec = Object.freeze({
    client: 'clientRepository',
    server: 'serverRepository',
    command: 'make:repository',
    noun: 'repositories',
});

const SIDES = ['client', 'server'] as const;

export function parseSide(value: string): SideOption {
    if (value === 'client' || value === 'server' || value === 'both') return value;
    throw new Error(`Invalid --side "${value}". Use client, server, or both.`);
}

export function resolveSides(profile: StackProfile, option: SideOption, spec: SideSpec): readonly Side[] {
    const available = SIDES.filter((side) => hasLayer(profile, spec[side]));
    if (available.length === 0) assertLayer(profile, spec.server, spec.command);
    if (option === 'both') return available;
    if (available.includes(option)) return [option];
    throw new Error(`The ${profile.name} stack has no ${option}-side ${spec.noun}.`);
}
