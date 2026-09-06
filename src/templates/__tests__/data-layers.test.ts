import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderService } from '../service';
import { renderClientRepository } from '../frontend/client-repository';
import { renderServerRepository } from '../backend/server-repository';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('data-templates');
});

afterEach(() => project.cleanup());

describe('renderService', () => {
    it('renders a client service on next-frontend', () => {
        const ctx = contextFor('next-frontend', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'CreateCat.service.ts');
        const content = renderService(ctx, 'Create', 'Cat', fromFile, 'client');
        expect(content).toContain("import { Cat } from '../types/Cat.types';");
        expect(content).toContain("import { CreateCat } from '../schemas/CreateCat.schema';");
        expect(content).toContain("import { CreateCatRepository } from '../repositories/CreateCat.repository';");
        expect(content).toContain('const repository = new CreateCatRepository();');
        expect(content).toContain('export class CreateCatService {');
        expect(content).toContain('async handle(data: CreateCat): Promise<Cat> {');
        expect(content).toContain('return repository.handle(data);');
    });

    it('points fullstack client services at client repositories', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(ctx.featureDir, 'client', 'services', 'ListCat.service.ts');
        const content = renderService(ctx, 'List', 'Cat', fromFile, 'client');
        expect(content).toContain("from '../repositories/ListCat.repository';");
        expect(content).toContain("from '../../types/Cat.types';");
    });

    it('points fullstack server services at server repositories', () => {
        const ctx = contextFor('next-fullstack', 'cat');
        const fromFile = path.join(ctx.featureDir, 'server', 'services', 'ShowCat.service.ts');
        const content = renderService(ctx, 'Show', 'Cat', fromFile, 'server');
        expect(content).toContain("from '../repositories/ShowCat.repository';");
        expect(content).not.toContain('@Injectable');
    });

    it('renders an injectable service with constructor injection on nest', () => {
        const ctx = contextFor('nest', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'UpdateCat.service.ts');
        const content = renderService(ctx, 'Update', 'Cat', fromFile, 'server');
        expect(content).toContain("import { Injectable } from '@nestjs/common';");
        expect(content).toContain('@Injectable()\nexport class UpdateCatService {');
        expect(content).toContain('constructor(private readonly repository: UpdateCatRepository) {}');
        expect(content).toContain('return this.repository.handle(id, data);');
        expect(content).not.toContain('new UpdateCatRepository()');
    });

    it('Delete imports only the repository', () => {
        const ctx = contextFor('node', 'cat');
        const fromFile = path.join(ctx.featureDir, 'services', 'DeleteCat.service.ts');
        const content = renderService(ctx, 'Delete', 'Cat', fromFile, 'server');
        expect(content).not.toContain('types/Cat.types');
        expect(content).toContain('async handle(id: string): Promise<void> {');
    });
});

describe('renderClientRepository', () => {
    it('fetches the feature api path', () => {
        const ctx = contextFor('next-frontend', 'coffee-type');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'CreateCoffeeType.repository.ts');
        const content = renderClientRepository(ctx, 'Create', 'CoffeeType', fromFile);
        expect(content).toContain("fetch('/api/coffee-type'");
        expect(content).toContain("method: 'POST'");
        expect(content).toContain("'Content-Type': 'application/json'");
        expect(content).toContain("import { CreateCoffeeType } from '../schemas/CreateCoffeeType.schema';");
    });

    it('Delete has no imports', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'DeleteCat.repository.ts');
        const content = renderClientRepository(ctx, 'Delete', 'Cat', fromFile);
        expect(content).not.toContain('import');
        expect(content).toContain("method: 'DELETE'");
    });

    it('Show interpolates the id', () => {
        const ctx = contextFor('react', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'ShowCat.repository.ts');
        expect(renderClientRepository(ctx, 'Show', 'Cat', fromFile)).toContain('fetch(`/api/cat/${id}`)');
    });
});

describe('renderServerRepository', () => {
    it('renders a not-implemented stub on node', () => {
        const ctx = contextFor('node', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'CreateCat.repository.ts');
        const content = renderServerRepository(ctx, 'Create', 'Cat', fromFile);
        expect(content).toContain("import { Cat } from '../types/Cat.types';");
        expect(content).toContain('export class CreateCatRepository {');
        expect(content).toContain('// TODO: implement with your ORM (Prisma, Drizzle, TypeORM, ...)');
        expect(content).toContain("throw new Error('CreateCatRepository.handle is not implemented');");
        expect(content).not.toContain('@Injectable');
    });

    it('is injectable on nest', () => {
        const ctx = contextFor('nest', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'ListCat.repository.ts');
        const content = renderServerRepository(ctx, 'List', 'Cat', fromFile);
        expect(content).toContain("import { Injectable } from '@nestjs/common';");
        expect(content).toContain('@Injectable()\nexport class ListCatRepository {');
    });

    it('Delete has no domain imports', () => {
        const ctx = contextFor('node', 'cat');
        const fromFile = path.join(ctx.featureDir, 'repositories', 'DeleteCat.repository.ts');
        const content = renderServerRepository(ctx, 'Delete', 'Cat', fromFile);
        expect(content.startsWith('export class DeleteCatRepository {')).toBe(true);
    });
});
