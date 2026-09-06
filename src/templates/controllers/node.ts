import { lowerFirst } from '../../utils/naming';
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { renderExpressController, renderExpressRoutes } from './express';
import { renderFastifyController, renderFastifyRoutes } from './fastify';
import { renderHonoController, renderHonoRoutes } from './hono';
import { renderGenericController } from './generic';

export function renderNodeController(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string
): string {
    switch (ctx.stack.httpFramework) {
        case 'express':
            return renderExpressController(ctx, spec, fromFile);
        case 'fastify':
            return renderFastifyController(ctx, spec, fromFile);
        case 'hono':
            return renderHonoController(ctx, spec, fromFile);
        case null:
            return renderGenericController(ctx, spec, entity, fromFile);
    }
}

export function renderNodeRoutes(ctx: RenderContext, entity: string, fromFile: string): string | null {
    switch (ctx.stack.httpFramework) {
        case 'express':
            return renderExpressRoutes(ctx, entity, fromFile);
        case 'fastify':
            return renderFastifyRoutes(ctx, entity, fromFile);
        case 'hono':
            return renderHonoRoutes(ctx, entity, fromFile);
        case null:
            return null;
    }
}

export function renderNodeRouteLine(ctx: RenderContext, spec: ActionSpec, entity: string): string | null {
    switch (ctx.stack.httpFramework) {
        case 'express':
            return `router.${spec.method}('${spec.path}', ${spec.handler});`;
        case 'fastify':
            return `app.${spec.method}('${spec.path}', ${spec.handler});`;
        case 'hono':
            return `${lowerFirst(entity)}.${spec.method}('${spec.path}', ${spec.handler});`;
        case null:
            return null;
    }
}
