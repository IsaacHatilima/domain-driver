import { StackProfile } from '../types';

export const node: StackProfile = Object.freeze({
    name: 'node',
    folders: ['controllers', 'services', 'repositories', 'schemas', 'types'] as const,
    layers: ['serverService', 'serverRepository', 'controller', 'schema', 'types'] as const,
    layerDirs: {
        serverService: 'services',
        serverRepository: 'repositories',
        controller: 'controllers',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: false,
    serverComponents: false,
});
