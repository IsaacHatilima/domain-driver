import { StackProfile } from '../types';

export const tanstackStart: StackProfile = Object.freeze({
    name: 'tanstack-start',
    folders: [
        '-components',
        '-containers',
        '-hooks',
        '-server/functions',
        '-server/services',
        '-server/repositories',
        '-schemas',
        '-types',
    ] as const,
    layers: [
        'page',
        'component',
        'container',
        'hook',
        'serverService',
        'serverRepository',
        'controller',
        'schema',
        'types',
    ] as const,
    layerDirs: {
        component: '-components',
        container: '-containers',
        hook: '-hooks',
        serverService: '-server/services',
        serverRepository: '-server/repositories',
        controller: '-server/functions',
        schema: '-schemas',
        types: '-types',
    },
    clientDirective: false,
    serverComponents: false,
    queryHooks: true,
});
