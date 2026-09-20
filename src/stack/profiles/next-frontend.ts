import { StackProfile } from '../types';

export const nextFrontend: StackProfile = Object.freeze({
    name: 'next-frontend',
    folders: [
        'components/client',
        'components/server',
        'containers',
        'hooks',
        'schemas',
        'types',
    ] as const,
    layers: ['page', 'component', 'container', 'hook', 'schema', 'types'] as const,
    layerDirs: {
        component: 'components',
        container: 'containers',
        hook: 'hooks',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: true,
    serverComponents: true,
    queryHooks: false,
});
