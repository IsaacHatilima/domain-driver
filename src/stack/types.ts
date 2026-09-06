export const STACK_NAMES = ['next-fullstack', 'next-frontend', 'react', 'node', 'nest'] as const;
export type StackName = (typeof STACK_NAMES)[number];

export const HTTP_FRAMEWORKS = ['express', 'fastify', 'hono'] as const;
export type HttpFramework = (typeof HTTP_FRAMEWORKS)[number];

export type StackSource = 'detected' | 'override';

export interface DetectedStack {
    readonly stack: StackName;
    readonly source: StackSource;
    readonly httpFramework: HttpFramework | null;
    readonly featureRoot: string;
    readonly hasNestjsZod: boolean;
}

export const LAYERS = [
    'page',
    'component',
    'container',
    'hook',
    'clientService',
    'clientRepository',
    'serverService',
    'serverRepository',
    'controller',
    'module',
    'dto',
    'schema',
    'types',
] as const;
export type Layer = (typeof LAYERS)[number];

export type Side = 'client' | 'server';
export type SideOption = Side | 'both';

export interface StackProfile {
    readonly name: StackName;
    readonly folders: readonly string[];
    readonly layers: readonly Layer[];
    readonly layerDirs: Readonly<Partial<Record<Layer, string>>>;
    readonly clientDirective: boolean;
    readonly serverComponents: boolean;
}

export function isStackName(value: string): value is StackName {
    return (STACK_NAMES as readonly string[]).includes(value);
}
