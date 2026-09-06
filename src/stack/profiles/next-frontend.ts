import { StackProfile } from '../types';

export const nextFrontend: StackProfile = Object.freeze({
    name: 'next-frontend',
    folders: [
        'components/client',
        'components/server',
        'containers',
        'hooks',
        'services',
        'repositories',
        'schemas',
        'types',
    ] as const,
    layers: ['page', 'component', 'container', 'hook', 'clientService', 'clientRepository', 'schema', 'types'] as const,
    layerDirs: {
        component: 'components',
        container: 'containers',
        hook: 'hooks',
        clientService: 'services',
        clientRepository: 'repositories',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: true,
    serverComponents: true,
});
