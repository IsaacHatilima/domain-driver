import { StackProfile } from '../types';

export const react: StackProfile = Object.freeze({
    name: 'react',
    folders: ['components', 'containers', 'hooks', 'services', 'repositories', 'schemas', 'types'] as const,
    layers: ['component', 'container', 'hook', 'clientService', 'clientRepository', 'schema', 'types'] as const,
    layerDirs: {
        component: 'components',
        container: 'containers',
        hook: 'hooks',
        clientService: 'services',
        clientRepository: 'repositories',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: false,
    serverComponents: false,
    queryHooks: false,
});
