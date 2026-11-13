import { pluralize, stripEntity, toKebabCase } from '../../utils/naming';
import { ActionSpec, HttpMethod } from '../actions';
import { RenderContext } from '../context';

export interface NestRoute {
    /** `@Controller(prefix)`: the area when the feature sits in one, the feature otherwise. */
    readonly prefix: string;
    readonly method: HttpMethod;
    /** The method decorator's path, below the prefix and without a leading slash; '' for the prefix itself. */
    readonly path: string;
}

/** Verbs that are the resource itself on a RESTful route, rather than a sub-route named after them. */
const RESOURCE_VERBS: ReadonlySet<string> = new Set(['List', 'Show', 'Create', 'Update', 'Delete']);

function withoutLeadingSlash(specPath: string): string {
    return specPath === '/' ? '' : specPath.slice(1);
}

/** An area named after the entity, singular or plural, holds that resource: `projects` for `Project`. */
export function isResourceArea(area: string, entity: string): boolean {
    return area === toKebabCase(entity) || area === toKebabCase(pluralize(entity));
}

/**
 * RESTful on the area, without the flow's slug. The verb is the action's name minus the entity:
 * List, Show, Create, Update and Delete are the resource or one record of it, and any other verb
 * is a sub-route, `archiveProject` on one record answering `:id/archive`. The standard Update is
 * a PATCH, as hand-written flows in an area use; a bespoke action keeps the method it was given.
 */
function resourceRoute(spec: ActionSpec, entity: string): Omit<NestRoute, 'prefix'> {
    const verb = stripEntity(spec.name, entity);
    const id = spec.usesId ? ':id' : null;
    if (verb === '' || RESOURCE_VERBS.has(verb)) {
        const method = !spec.custom && verb === 'Update' ? 'patch' : spec.method;
        return { method, path: id ?? '' };
    }
    return { method: spec.method, path: [id, toKebabCase(verb)].filter((part) => part !== null).join('/') };
}

/**
 * Under an area that groups flows, the feature's own route moves into the method decorator: a
 * flow answers at its slug, `/auth/login`, and on one record at `:id/<slug>`. Anything else keeps
 * the route it had below the feature, now below the feature's slug.
 */
function flowPath(spec: ActionSpec, feature: string): string {
    const own = withoutLeadingSlash(spec.path);
    if (spec.custom && own === ':id') return `:id/${feature}`;
    return own === '' ? feature : `${feature}/${own}`;
}

/**
 * Where a Nest controller answers. Without an area module the feature is the prefix, as before.
 * In an area every flow shares the area's prefix, so the routes read `/<area>/...` and the flows
 * of one area never repeat their own names in the URL unless they need to.
 */
export function nestRoute(ctx: RenderContext, spec: ActionSpec, entity: string): NestRoute {
    if (ctx.area === null) {
        return { prefix: ctx.feature, method: spec.method, path: withoutLeadingSlash(spec.path) };
    }
    if (isResourceArea(ctx.area, entity)) {
        return { prefix: ctx.area, ...resourceRoute(spec, entity) };
    }
    return { prefix: ctx.area, method: spec.method, path: flowPath(spec, ctx.feature) };
}

/** `POST /projects/:id/archive`. */
export function describeNestRoute(route: NestRoute): string {
    const url = route.path === '' ? `/${route.prefix}` : `/${route.prefix}/${route.path}`;
    return `${route.method.toUpperCase()} ${url}`;
}

/**
 * A one-segment literal GET in a resource area, such as `/projects/find-active`, is what another
 * flow's `GET /projects/:id` matches first when its module is registered earlier.
 */
export function canBeSwallowedById(ctx: RenderContext, route: NestRoute, entity: string): boolean {
    if (ctx.area === null || !isResourceArea(ctx.area, entity)) return false;
    return route.method === 'get' && route.path !== '' && !route.path.includes('/') && !route.path.startsWith(':');
}
