export const STACK_NAMES = ['next-fullstack', 'next-frontend', 'react', 'node', 'nest', 'tanstack-start'] as const;
export type StackName = (typeof STACK_NAMES)[number];

export const HTTP_FRAMEWORKS = ['express', 'fastify', 'hono'] as const;
export type HttpFramework = (typeof HTTP_FRAMEWORKS)[number];

export type StackSource = 'detected' | 'override';

/** Where the feature root came from, in precedence order: flag, config, then convention. */
export type RootSource = 'flag' | 'config' | 'detected';

export interface DetectedStack {
    readonly stack: StackName;
    readonly source: StackSource;
    readonly httpFramework: HttpFramework | null;
    readonly featureRoot: string;
    readonly featureRootSource: RootSource;
    readonly hasNestjsZod: boolean;
    /** Explicit path to the Nest root module, when the conventional probe would miss it. */
    readonly rootModule: string | null;
    /** Whether generated Nest classes are wired into their module files automatically. */
    readonly autoRegister: boolean;
}

export const LAYERS = [
    'page',
    'component',
    'container',
    'hook',
    'serverService',
    'serverRepository',
    'controller',
    'module',
    'dto',
    'schema',
    'types',
] as const;
export type Layer = (typeof LAYERS)[number];

export interface StackProfile {
    readonly name: StackName;
    readonly folders: readonly string[];
    readonly layers: readonly Layer[];
    readonly layerDirs: Readonly<Partial<Record<Layer, string>>>;
    readonly clientDirective: boolean;
    readonly serverComponents: boolean;
    readonly queryHooks: boolean;
}

export function isStackName(value: string): value is StackName {
    return (STACK_NAMES as readonly string[]).includes(value);
}
