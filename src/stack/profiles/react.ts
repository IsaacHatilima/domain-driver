import { StackProfile } from '../types';

export const react: StackProfile = Object.freeze({
    name: 'react',
    folders: ['components', 'containers', 'hooks', 'schemas', 'types'] as const,
    layers: ['component', 'container', 'hook', 'schema', 'types'] as const,
    layerDirs: {
        component: 'components',
        container: 'containers',
        hook: 'hooks',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: false,
    serverComponents: false,
    queryHooks: false,
});
