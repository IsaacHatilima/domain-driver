import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeController } from '../controller';
import {
    createTempProject,
    writePackageJson,
    mkdir,
    readProjectFile,
    projectFileExists,
    listFiles,
    TempProject,
} from '../../__tests__/helpers/project';

let project: TempProject;

const CONTROLLER_FILES = ['List', 'Show', 'Create', 'Update', 'Delete']
    .map((action) => `${action}Cat.controller.ts`)
    .sort();

beforeEach(() => {
    project = createTempProject('controller');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('on node', () => {
    it.each([
        ['express', "from 'express'"],
        ['fastify', "from 'fastify'"],
        ['hono', "from 'hono'"],
    ])('writes five %s controllers and a routes file', (framework, marker) => {
        writePackageJson({ [framework]: '1' });
        mkdir('src/features/cat');
        makeController('cat', 'Cat');
        expect(listFiles('src/features/cat/controllers')).toEqual(CONTROLLER_FILES);
        expect(readProjectFile('src/features/cat/controllers/CreateCat.controller.ts')).toContain(marker);
        expect(readProjectFile('src/features/cat/cat.routes.ts')).toContain(marker);
    });

    it('falls back to generic controllers with an info line and no routes file', () => {
        writePackageJson({});
        mkdir('src/features/cat');
        makeController('cat', 'Cat');
        expect(readProjectFile('src/features/cat/controllers/CreateCat.controller.ts')).toContain(
            'export class CreateCatController'
        );
        expect(projectFileExists('src/features/cat/cat.routes.ts')).toBe(false);
        expect(console.log).toHaveBeenCalledWith(
            'ℹ️  No HTTP framework detected, generating framework-agnostic controllers.'
        );
    });
});

describe('on nest', () => {
    it('writes five decorated controllers', () => {
        writePackageJson({ '@nestjs/core': '1' });
        mkdir('src/cat');
        makeController('cat', 'Cat');
        expect(listFiles('src/cat/controllers')).toEqual(CONTROLLER_FILES);
        expect(readProjectFile('src/cat/controllers/ShowCat.controller.ts')).toContain("@Controller('cat')");
        expect(projectFileExists('src/cat/cat.routes.ts')).toBe(false);
    });
});

describe('on next-fullstack', () => {
    it('writes the collection and item route handlers', () => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        mkdir('app/cat');
        makeController('cat', 'Cat');
        expect(readProjectFile('app/api/cat/route.ts')).toContain('export async function POST');
        expect(readProjectFile('app/api/cat/[id]/route.ts')).toContain('export async function DELETE');
        expect(projectFileExists('app/cat/controllers')).toBe(false);
    });

    it('skips existing route files', () => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        mkdir('app/cat');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        makeController('cat', 'Cat');
        makeController('cat', 'Cat');
        expect(warn).toHaveBeenCalledWith('⚠️  Skipping "route.ts" — already exists');
    });
});

describe('on frontend-only stacks', () => {
    it.each([
        [{ next: '1' }, 'app/cat', 'next-frontend'],
        [{ react: '1' }, 'src/features/cat', 'react'],
    ])('rejects %o', (deps, featurePath, stack) => {
        writePackageJson(deps);
        mkdir(featurePath);
        expect(() => makeController('cat', 'Cat')).toThrow(
            `make:controller is not available for the ${stack} stack.`
        );
    });
});
