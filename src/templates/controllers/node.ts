import { Action } from '../actions';
import { RenderContext } from '../context';
import { renderExpressController, renderExpressRoutes } from './express';
import { renderFastifyController, renderFastifyRoutes } from './fastify';
import { renderHonoController, renderHonoRoutes } from './hono';
import { renderGenericController } from './generic';

export function renderNodeController(
    ctx: RenderContext,
    action: Action,
    entity: string,
    fromFile: string
): string {
    switch (ctx.stack.httpFramework) {
        case 'express':
            return renderExpressController(ctx, action, entity, fromFile);
        case 'fastify':
            return renderFastifyController(ctx, action, entity, fromFile);
        case 'hono':
            return renderHonoController(ctx, action, entity, fromFile);
        case null:
            return renderGenericController(ctx, action, entity, fromFile);
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
