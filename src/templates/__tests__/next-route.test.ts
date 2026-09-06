import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderCollectionRoute, renderItemRoute } from '../controllers/next-route';
import { renderActionRoute } from '../controllers/next-action-route';
import { customAction } from '../actions';
import { apiRouteDir } from '../../utils/paths';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, writeTsconfig, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('next-route');
});

afterEach(() => project.cleanup());

describe('renderCollectionRoute', () => {
    it('exports GET and POST calling the server services', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(apiRouteDir(ctx.stack, 'cat'), 'route.ts');
        const content = renderCollectionRoute(ctx, 'Cat', fromFile);
        expect(content).toContain("import { NextResponse } from 'next/server';");
        expect(content).toContain("import { CreateCatSchema } from '../../cat/schemas/CreateCat.schema';");
        expect(content).toContain("import { ListCatService } from '../../cat/server/services/ListCat.service';");
        expect(content).toContain("import { CreateCatService } from '../../cat/server/services/CreateCat.service';");
        expect(content).toContain('export async function GET(): Promise<NextResponse> {');
        expect(content).toContain('return NextResponse.json(await listService.handle());');
        expect(content).toContain('export async function POST(request: Request): Promise<NextResponse> {');
        expect(content).toContain('const parsed = CreateCatSchema.safeParse(await request.json());');
        expect(content).toContain('return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });');
        expect(content).toContain('return NextResponse.json(await createService.handle(parsed.data), { status: 201 });');
    });

    it('uses the alias when configured', () => {
        writeTsconfig({ '@/*': ['./*'] });
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(apiRouteDir(ctx.stack, 'cat'), 'route.ts');
        expect(renderCollectionRoute(ctx, 'Cat', fromFile)).toContain("from '@/app/cat/server/services/ListCat.service';");
    });
});

describe('renderItemRoute', () => {
    it('exports GET, PUT, and DELETE with async params', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(apiRouteDir(ctx.stack, 'cat'), '[id]', 'route.ts');
        const content = renderItemRoute(ctx, 'Cat', fromFile);
        expect(content).toContain("import { UpdateCatSchema } from '../../../cat/schemas/UpdateCat.schema';");
        expect(content).toContain("import { ShowCatService } from '../../../cat/server/services/ShowCat.service';");
        expect(content).toContain('type RouteContext = { params: Promise<{ id: string }> };');
        expect(content).toContain('export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {');
        expect(content).toContain('const { id } = await params;');
        expect(content).toContain('return NextResponse.json(await showService.handle(id));');
        expect(content).toContain('export async function PUT(request: Request, { params }: RouteContext): Promise<NextResponse> {');
        expect(content).toContain('return NextResponse.json(await updateService.handle(id, parsed.data));');
        expect(content).toContain('export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {');
        expect(content).toContain('await deleteService.handle(id);');
        expect(content).toContain('return new Response(null, { status: 204 });');
    });
});

describe('renderActionRoute', () => {
    it('GET list', () => {
        const ctx = contextFor('next-fullstack', 'users');
        const spec = customAction('User', 'findActiveUsers', { withInput: false, returns: 'list' });
        const fromFile = path.join(apiRouteDir(ctx.stack, 'users'), 'find-active-users', 'route.ts');
        const content = renderActionRoute(ctx, spec, fromFile);
        expect(content).toContain("import { FindActiveUsersService } from '../../../users/server/services/FindActiveUsers.service';");
        expect(content).not.toContain('Schema');
        expect(content).toContain('export async function GET(): Promise<NextResponse> {');
        expect(content).toContain('return NextResponse.json(await service.handle());');
    });

    it('POST with input returning one', () => {
        const ctx = contextFor('next-fullstack', 'users');
        const spec = customAction('User', 'archiveUser', { withInput: true, returns: 'one' });
        const fromFile = path.join(apiRouteDir(ctx.stack, 'users'), 'archive-user', 'route.ts');
        const content = renderActionRoute(ctx, spec, fromFile);
        expect(content).toContain("import { ArchiveUserSchema } from '../../../users/schemas/ArchiveUser.schema';");
        expect(content).toContain('export async function POST(request: Request): Promise<NextResponse> {');
        expect(content).toContain('const parsed = ArchiveUserSchema.safeParse(await request.json());');
        expect(content).toContain('return NextResponse.json(await service.handle(parsed.data));');
    });

    it('void returns an empty 204', () => {
        const ctx = contextFor('next-fullstack', 'users');
        const spec = customAction('User', 'purgeUsers', { withInput: false, returns: 'void' });
        const fromFile = path.join(apiRouteDir(ctx.stack, 'users'), 'purge-users', 'route.ts');
        const content = renderActionRoute(ctx, spec, fromFile);
        expect(content).toContain('export async function GET(): Promise<Response> {');
        expect(content).toContain('await service.handle();');
        expect(content).toContain('return new Response(null, { status: 204 });');
    });
});
