import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { controllerShape, handlerName } from '../controllers/shape';
import { renderExpressController, renderExpressRoutes } from '../controllers/express';
import { renderFastifyController, renderFastifyRoutes } from '../controllers/fastify';
import { renderHonoController, renderHonoRoutes } from '../controllers/hono';
import { renderGenericController } from '../controllers/generic';
import { renderNodeController, renderNodeRoutes } from '../controllers/node';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';
import { RenderContext } from '../context';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('node-controllers');
});

afterEach(() => project.cleanup());

const controllerFile = (ctx: RenderContext, action: string): string =>
    path.join(ctx.featureDir, 'controllers', `${action}Cat.controller.ts`);
const routesFile = (ctx: RenderContext): string => path.join(ctx.featureDir, 'cat.routes.ts');

describe('controllerShape', () => {
    it('maps actions to status and inputs', () => {
        expect(controllerShape('List')).toEqual({ status: 200, usesBody: false, usesId: false });
        expect(controllerShape('Create')).toEqual({ status: 201, usesBody: true, usesId: false });
        expect(controllerShape('Update')).toEqual({ status: 200, usesBody: true, usesId: true });
        expect(controllerShape('Delete')).toEqual({ status: 204, usesBody: false, usesId: true });
    });

    it('names handlers in camelCase', () => {
        expect(handlerName('Create', 'CoffeeType')).toBe('createCoffeeTypeController');
    });
});

describe('express', () => {
    const ctx = () => contextFor('node', 'cat', { httpFramework: 'express' });

    it('validates the body and responds 201 on create', () => {
        const content = renderExpressController(ctx(), 'Create', 'Cat', controllerFile(ctx(), 'Create'));
        expect(content).toContain("import { NextFunction, Request, Response } from 'express';");
        expect(content).toContain("import { CreateCatSchema } from '../schemas/CreateCat.schema';");
        expect(content).toContain("import { CreateCatService } from '../services/CreateCat.service';");
        expect(content).toContain('export async function createCatController(req: Request, res: Response, next: NextFunction): Promise<void> {');
        expect(content).toContain('const parsed = CreateCatSchema.safeParse(req.body);');
        expect(content).toContain('res.status(400).json({ errors: parsed.error.flatten() });');
        expect(content).toContain('res.status(201).json(await service.handle(parsed.data));');
        expect(content).toContain('next(error);');
    });

    it('does not type id for create', () => {
        const content = renderExpressController(ctx(), 'Create', 'Cat', controllerFile(ctx(), 'Create'));
        expect(content).toContain('createCatController(req: Request, res: Response, next: NextFunction)');
    });

    it('uses the id on update and delete', () => {
        const show = renderExpressController(ctx(), 'Show', 'Cat', controllerFile(ctx(), 'Show'));
        expect(show).toContain('showCatController(req: Request<{ id: string }>, res: Response, next: NextFunction)');
        const update = renderExpressController(ctx(), 'Update', 'Cat', controllerFile(ctx(), 'Update'));
        expect(update).toContain('updateCatController(req: Request<{ id: string }>, res: Response, next: NextFunction)');
        expect(update).toContain('service.handle(req.params.id, parsed.data)');
        const del = renderExpressController(ctx(), 'Delete', 'Cat', controllerFile(ctx(), 'Delete'));
        expect(del).toContain('deleteCatController(req: Request<{ id: string }>, res: Response, next: NextFunction)');
        expect(del).toContain('await service.handle(req.params.id);');
        expect(del).toContain('res.status(204).send();');
        expect(del).not.toContain('Schema');
    });

    it('prefixes the unused request on list', () => {
        const content = renderExpressController(ctx(), 'List', 'Cat', controllerFile(ctx(), 'List'));
        expect(content).toContain('listCatController(_req: Request, res: Response, next: NextFunction)');
    });

    it('renders a router with five routes', () => {
        const content = renderExpressRoutes(ctx(), 'Cat', routesFile(ctx()));
        expect(content).toContain("import { Router } from 'express';");
        expect(content).toContain("import { listCatController } from './controllers/ListCat.controller';");
        expect(content).toContain("router.get('/', listCatController);");
        expect(content).toContain("router.get('/:id', showCatController);");
        expect(content).toContain("router.post('/', createCatController);");
        expect(content).toContain("router.put('/:id', updateCatController);");
        expect(content).toContain("router.delete('/:id', deleteCatController);");
        expect(content).toContain('export default router;');
        expect(content).toContain("// app.use('/cat', catRoutes);");
    });
});

describe('fastify', () => {
    const ctx = () => contextFor('node', 'cat', { httpFramework: 'fastify' });

    it('types params on show', () => {
        const content = renderFastifyController(ctx(), 'Show', 'Cat', controllerFile(ctx(), 'Show'));
        expect(content).toContain("import { FastifyReply, FastifyRequest } from 'fastify';");
        expect(content).toContain('request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply');
        expect(content).toContain('reply.status(200).send(await service.handle(request.params.id));');
    });

    it('validates the body on create', () => {
        const content = renderFastifyController(ctx(), 'Create', 'Cat', controllerFile(ctx(), 'Create'));
        expect(content).toContain('const parsed = CreateCatSchema.safeParse(request.body);');
        expect(content).toContain('reply.status(400).send({ errors: parsed.error.flatten() });');
        expect(content).toContain('reply.status(201).send(await service.handle(parsed.data));');
    });

    it('renders a plugin', () => {
        const content = renderFastifyRoutes(ctx(), 'Cat', routesFile(ctx()));
        expect(content).toContain("import { FastifyInstance } from 'fastify';");
        expect(content).toContain('export async function catRoutes(app: FastifyInstance): Promise<void> {');
        expect(content).toContain("app.delete('/:id', deleteCatController);");
        expect(content).toContain("// app.register(catRoutes, { prefix: '/cat' });");
    });
});

describe('hono', () => {
    const ctx = () => contextFor('node', 'cat', { httpFramework: 'hono' });

    it('reads params and json from the context', () => {
        const content = renderHonoController(ctx(), 'Update', 'Cat', controllerFile(ctx(), 'Update'));
        expect(content).toContain("import { Context } from 'hono';");
        expect(content).toContain("export async function updateCatController(c: Context<{}, '/:id'>): Promise<Response> {");
        expect(content).toContain('const parsed = UpdateCatSchema.safeParse(await c.req.json());');
        expect(content).toContain("return c.json({ errors: parsed.error.flatten() }, 400);");
        expect(content).toContain("return c.json(await service.handle(c.req.param('id'), parsed.data), 200);");
    });

    it('returns an empty 204 on delete', () => {
        const content = renderHonoController(ctx(), 'Delete', 'Cat', controllerFile(ctx(), 'Delete'));
        expect(content).toContain("await service.handle(c.req.param('id'));");
        expect(content).toContain('return c.body(null, 204);');
    });

    it('does not type context path for list', () => {
        const content = renderHonoController(ctx(), 'List', 'Cat', controllerFile(ctx(), 'List'));
        expect(content).toContain('export async function listCatController(c: Context): Promise<Response> {');
    });

    it('renders a Hono app', () => {
        const content = renderHonoRoutes(ctx(), 'Cat', routesFile(ctx()));
        expect(content).toContain("import { Hono } from 'hono';");
        expect(content).toContain('const cat = new Hono();');
        expect(content).toContain("cat.post('/', createCatController);");
        expect(content).toContain('export default cat;');
        expect(content).toContain("// app.route('/cat', cat);");
    });
});

describe('generic', () => {
    const ctx = () => contextFor('node', 'cat');

    it('renders a class that parses input', () => {
        const content = renderGenericController(ctx(), 'Create', 'Cat', controllerFile(ctx(), 'Create'));
        expect(content).toContain("import { Cat } from '../types/Cat.types';");
        expect(content).toContain('export class CreateCatController {');
        expect(content).toContain('async handle(input: unknown): Promise<Cat> {');
        expect(content).toContain('return service.handle(CreateCatSchema.parse(input));');
    });

    it('takes id and input on update', () => {
        const content = renderGenericController(ctx(), 'Update', 'Cat', controllerFile(ctx(), 'Update'));
        expect(content).toContain('async handle(id: string, input: unknown): Promise<Cat> {');
        expect(content).toContain('return service.handle(id, UpdateCatSchema.parse(input));');
    });

    it('list takes nothing', () => {
        const content = renderGenericController(ctx(), 'List', 'Cat', controllerFile(ctx(), 'List'));
        expect(content).toContain('async handle(): Promise<Cat[]> {');
        expect(content).toContain('return service.handle();');
    });
});

describe('node dispatcher', () => {
    it('picks the template by framework', () => {
        const express = contextFor('node', 'cat', { httpFramework: 'express' });
        expect(renderNodeController(express, 'List', 'Cat', controllerFile(express, 'List'))).toContain("from 'express'");
        const hono = contextFor('node', 'cat', { httpFramework: 'hono' });
        expect(renderNodeRoutes(hono, 'Cat', routesFile(hono))).toContain("from 'hono'");
    });

    it('falls back to generic with no routes', () => {
        const ctx = contextFor('node', 'cat');
        expect(renderNodeController(ctx, 'List', 'Cat', controllerFile(ctx, 'List'))).toContain('export class ListCatController');
        expect(renderNodeRoutes(ctx, 'Cat', routesFile(ctx))).toBeNull();
    });
});
