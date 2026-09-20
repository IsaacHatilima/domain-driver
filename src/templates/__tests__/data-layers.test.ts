import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderService } from '../service';
import { renderHook } from '../frontend/hook';
import { renderQueryHook } from '../frontend/query-hook';
import { serverFnCall } from '../frontend/http';
import { renderServerRepository } from '../backend/server-repository';
import { customAction, standardAction } from '../actions';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('data-templates');
});

afterEach(() => project.cleanup());

describe('renderService', () => {
    it('renders a plain service wired to the server repository', () => {
        const ctx = contextFor('node', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'CreateCat.service.ts');
        const content = renderService(ctx, standardAction('Create', 'Cat'), 'Cat', fromFile);
        expect(content).toContain("import { Cat } from '../types/Cat.types';");
        expect(content).toContain("import { CreateCat } from '../schemas/CreateCat.schema';");
        expect(content).toContain("import { CreateCatRepository } from '../repositories/CreateCat.repository';");
        expect(content).toContain('const repository = new CreateCatRepository();');
        expect(content).toContain('export class CreateCatService {');
        expect(content).toContain('async handle(data: CreateCat): Promise<Cat> {');
        expect(content).toContain('return repository.handle(data);');
    });

    it('has no repository to point at on the frontend-only stacks', () => {
        for (const stack of ['next-frontend', 'react'] as const) {
            const ctx = contextFor(stack, 'cat');
            const fromFile = path.join(ctx.featureDir, 'services', 'CreateCat.service.ts');
            expect(() => renderService(ctx, standardAction('Create', 'Cat'), 'Cat', fromFile)).toThrow(
                `Layer "serverRepository" has no directory in the ${stack} profile.`
            );
        }
    });

    it('points fullstack services at the server repository and the shared types', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(ctx.featureDir, 'server', 'services', 'ListCat.service.ts');
        const content = renderService(ctx, standardAction('List', 'Cat'), 'Cat', fromFile);
        expect(content).toContain("from '../repositories/ListCat.repository';");
        expect(content).toContain("from '../../types/Cat.types';");
        expect(content).not.toContain('client/');
    });

    it('renders the fullstack service without the nest decorator', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(ctx.featureDir, 'server', 'services', 'ShowCat.service.ts');
        const content = renderService(ctx, standardAction('Show', 'Cat'), 'Cat', fromFile);
        expect(content).toContain("from '../repositories/ShowCat.repository';");
        expect(content).not.toContain('@Injectable');
    });

    it('renders an injectable service with constructor injection on nest', () => {
        const ctx = contextFor('nest', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'UpdateCat.service.ts');
        const content = renderService(ctx, standardAction('Update', 'Cat'), 'Cat', fromFile);
        expect(content).toContain("import { Injectable } from '@nestjs/common';");
        expect(content).toContain('@Injectable()\nexport class UpdateCatService {');
        expect(content).toContain('constructor(private readonly repository: UpdateCatRepository) {}');
        expect(content).toContain('return this.repository.handle(id, data);');
        expect(content).not.toContain('new UpdateCatRepository()');
    });

    it('Delete imports only the repository', () => {
        const ctx = contextFor('node', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'DeleteCat.service.ts');
        const content = renderService(ctx, standardAction('Delete', 'Cat'), 'Cat', fromFile);
        expect(content).not.toContain('types/Cat.types');
        expect(content).toContain('async handle(id: string): Promise<void> {');
    });
});

/**
 * The hook is what used to be the client repository: it owns the request to the API,
 * because the service and the repository now live behind that API, on the server.
 */
describe('renderHook requests the API', () => {
    it('fetches the feature api path', () => {
        const ctx = contextFor('next-frontend', 'coffee-type');
        const fromFile = path.join(ctx.featureDir, 'hooks', 'CreateCoffeeType.hook.ts');
        const content = renderHook(ctx, standardAction('Create', 'CoffeeType'), 'CoffeeType', fromFile);
        expect(content).toContain("fetch('/api/coffee-type'");
        expect(content).toContain("method: 'POST'");
        expect(content).toContain("'Content-Type': 'application/json'");
        expect(content).toContain('body: JSON.stringify(data),');
        expect(content).toContain("import { CreateCoffeeType } from '../schemas/CreateCoffeeType.schema';");
        expect(content).not.toContain('Service');
    });

    it('Delete has no domain imports and sends no body', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'hooks', 'DeleteCat.hook.ts');
        const content = renderHook(ctx, standardAction('Delete', 'Cat'), 'Cat', fromFile);
        expect(content).not.toContain("from '../types");
        expect(content).not.toContain("from '../schemas");
        expect(content).toContain("method: 'DELETE',");
        expect(content).not.toContain('body: JSON.stringify');
    });

    it('Show interpolates the id', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'hooks', 'ShowCat.hook.ts');
        const content = renderHook(ctx, standardAction('Show', 'Cat'), 'Cat', fromFile);
        expect(content).toContain('await fetch(`/api/cat/${id}`);');
    });
});

describe('renderServerRepository', () => {
    it('renders a not-implemented stub on node', () => {
        const ctx = contextFor('node', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'CreateCat.repository.ts');
        const content = renderServerRepository(ctx, standardAction('Create', 'Cat'), 'Cat', fromFile);
        expect(content).toContain("import { Cat } from '../types/Cat.types';");
        expect(content).toContain('export class CreateCatRepository {');
        expect(content).toContain('// TODO: implement with your ORM (Prisma, Drizzle, TypeORM, ...)');
        expect(content).toContain("throw new Error('CreateCatRepository.handle is not implemented');");
        expect(content).not.toContain('@Injectable');
    });

    it('is injectable on nest', () => {
        const ctx = contextFor('nest', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'ListCat.repository.ts');
        const content = renderServerRepository(ctx, standardAction('List', 'Cat'), 'Cat', fromFile);
        expect(content).toContain("import { Injectable } from '@nestjs/common';");
        expect(content).toContain('@Injectable()\nexport class ListCatRepository {');
    });

    it('Delete has no domain imports', () => {
        const ctx = contextFor('node', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'DeleteCat.repository.ts');
        const content = renderServerRepository(ctx, standardAction('Delete', 'Cat'), 'Cat', fromFile);
        expect(content.startsWith('export class DeleteCatRepository {')).toBe(true);
    });
});

describe('custom action specs through the data templates', () => {
    it('the hook GETs the slug path and reads json into state', () => {
        const ctx = contextFor('react', 'users');
        const spec = customAction('User', 'findActiveUsers', { withInput: false, returns: 'list' });
        const fromFile = path.join(ctx.featureDir, 'hooks', 'FindActiveUsers.hook.ts');
        const content = renderHook(ctx, spec, 'User', fromFile);
        expect(content).toContain("import { User } from '../types/User.types';");
        expect(content).toContain('export function useFindActiveUsers() {');
        expect(content).toContain('const [data, setData] = useState<User[]>([]);');
        expect(content).toContain("const response = await fetch('/api/users/find-active-users');");
        expect(content).toContain("if (!response.ok) throw new Error('Failed to findActiveUsers User');");
        expect(content).toContain('setData((await response.json()) as User[]);');
    });

    it('the hook POSTs a body and reads nothing back for void', () => {
        const ctx = contextFor('react', 'users');
        const spec = customAction('User', 'notifyUsers', { withInput: true, returns: 'void' });
        const fromFile = path.join(ctx.featureDir, 'hooks', 'NotifyUsers.hook.ts');
        const content = renderHook(ctx, spec, 'User', fromFile);
        expect(content).toContain("import { NotifyUsers } from '../schemas/NotifyUsers.schema';");
        expect(content).not.toContain('types/User.types');
        expect(content).toContain("const response = await fetch('/api/users/notify-users', {");
        expect(content).toContain("method: 'POST',");
        expect(content).toContain('body: JSON.stringify(data),');
        expect(content).toContain('onSuccess?.();');
        expect(content).not.toContain('response.json()');
    });

    it('server repository and service use the action name without the entity', () => {
        const ctx = contextFor('nest', 'users');
        const spec = customAction('User', 'archiveUser', { withInput: true, returns: 'one' });
        const repo = renderServerRepository(ctx, spec, 'User', path.join(ctx.featureDir, 'repositories', 'ArchiveUser.repository.ts'));
        expect(repo).toContain('@Injectable()\nexport class ArchiveUserRepository {');
        expect(repo).toContain('async handle(data: ArchiveUser): Promise<User> {');
        const service = renderService(ctx, spec, 'User', path.join(ctx.featureDir, 'services', 'ArchiveUser.service.ts'));
        expect(service).toContain("import { ArchiveUserRepository } from '../repositories/ArchiveUser.repository';");
        expect(service).toContain('constructor(private readonly repository: ArchiveUserRepository) {}');
    });
});

/**
 * On tanstack-start the server function stands in for the API route, so the hook imports
 * and calls it directly. `serverFnCall` shapes the single `data` argument it is called with.
 */
describe('serverFnCall', () => {
    const ctx = contextFor('tanstack-start', 'cat');
    const file = (name: string) => path.join(ctx.featureDir, `-hooks/${name}.hook.ts`);

    it('is called from the hook, with no repository and no fetch in between', () => {
        const content = renderQueryHook(ctx, standardAction('List', 'Cat'), 'Cat', file('ListCat'));
        expect(content).toContain("import { listCat } from '../-server/functions/ListCat.fn';");
        expect(content).toContain('=> listCat(),');
        expect(content).not.toContain('fetch(');
        expect(content).not.toContain('Service');
        expect(content).not.toContain('Repository');
    });

    it('calls a no-argument server function', () => {
        expect(serverFnCall(standardAction('List', 'Cat'))).toBe('()');
    });

    it('passes a bare id as data', () => {
        expect(serverFnCall(standardAction('Show', 'Cat'))).toBe('({ data: id })');
    });

    it('passes a payload as data', () => {
        expect(serverFnCall(standardAction('Create', 'Cat'))).toBe('({ data })');
    });

    it('wraps id and payload together', () => {
        expect(serverFnCall(standardAction('Update', 'Cat'))).toBe('({ data: { id, data } })');
    });
});
