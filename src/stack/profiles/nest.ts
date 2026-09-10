import { StackProfile } from '../types';

export const nest: StackProfile = Object.freeze({
    name: 'nest',
    folders: ['controllers', 'services', 'repositories', 'schemas', 'dto', 'types'] as const,
    layers: ['serverService', 'serverRepository', 'controller', 'module', 'dto', 'schema', 'types'] as const,
    layerDirs: {
        serverService: 'services',
        serverRepository: 'repositories',
        controller: 'controllers',
        dto: 'dto',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: false,
    serverComponents: false,
    queryHooks: false,
});
