import { StackProfile } from '../types';

/**
 * A Next app that owns its server side. Pages read through async Server Component containers that
 * call the services, and forms write through one Server Action per write in `server/actions`. The
 * route handler and fetch hook layers stay for `--route`, for callers outside the app such as
 * webhooks or a mobile client.
 */
export const nextFullstack: StackProfile = Object.freeze({
    name: 'next-fullstack',
    folders: [
        'components/client',
        'components/server',
        'containers',
        'server/actions',
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
        'serverAction',
        'schema',
        'types',
    ] as const,
    layerDirs: {
        component: 'components',
        container: 'containers',
        hook: 'hooks',
        serverAction: 'server/actions',
        serverService: 'server/services',
        serverRepository: 'server/repositories',
        schema: 'schemas',
        types: 'types',
    },
    clientDirective: true,
    serverComponents: true,
    queryHooks: false,
    serverActions: true,
});
