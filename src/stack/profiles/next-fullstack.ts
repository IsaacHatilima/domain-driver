import { StackProfile } from '../types';

export const nextFullstack: StackProfile = Object.freeze({
    name: 'next-fullstack',
    folders: [
        'components/client',
        'components/server',
        'containers',
        'hooks',
        'server/services',
        'server/repositories',
        'schemas',
        'types',
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
        component: 'components',
        container: 'containers',
        hook: 'hooks',
        serverService: 'server/services',
        serverRepository: 'server/repositories',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: true,
    serverComponents: true,
    queryHooks: false,
});
