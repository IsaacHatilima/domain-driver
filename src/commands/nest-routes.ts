import { areaModulePath } from '../nest/area';
import { ActionSpec } from '../templates/actions';
import { RenderContext } from '../templates/context';
import { canBeSwallowedById, describeNestRoute, nestRoute } from '../templates/controllers/nest-route';
import { featureModuleName } from '../templates/nest/module';
import { joinWithAnd } from '../utils/text';

/**
 * Inside an area a controller does not answer at its feature's name, so the command says where it
 * does. Nest matches routes in module registration order, so a literal GET that another flow's
 * `GET /<area>/:id` would match first also says which module has to come first.
 */
export function hintNestRoute(ctx: RenderContext, spec: ActionSpec, entity: string): void {
    if (ctx.profile.name !== 'nest' || ctx.area === null) return;
    const route = nestRoute(ctx, spec, entity);
    console.log(`ℹ️  ${spec.name}Controller answers ${describeNestRoute(route)}`);
    if (!canBeSwallowedById(ctx, route, entity)) return;
    console.log(
        `ℹ️  If another flow in ${areaModulePath(ctx.stack.featureRoot)} answers GET /${ctx.area}/:id, ` +
            `import ${featureModuleName(ctx.feature)} ahead of it, or that route answers ${describeNestRoute(route)}.`
    );
}

/** The routes a feature's standard controllers answer inside an area, in one line. */
export function hintNestRoutes(ctx: RenderContext, specs: readonly ActionSpec[], entity: string): void {
    if (ctx.profile.name !== 'nest' || ctx.area === null) return;
    const routes = specs.map((spec) => describeNestRoute(nestRoute(ctx, spec, entity)));
    console.log(`ℹ️  The controllers answer ${joinWithAnd(routes)}`);
}
