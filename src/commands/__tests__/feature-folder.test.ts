import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { makeAction } from '../action';
import { makeComponent } from '../component';
import { makeContainer } from '../container';
import { makeController } from '../controller';
import { makeHook } from '../hook';
import { makeRepository } from '../repository';
import { makeSchema } from '../schema';
import { makeService } from '../service';
import { makeTypes } from '../types';
import {
    createTempProject,
    listFiles,
    mkdir,
    projectFileExists,
    writePackageJson,
    TempProject,
} from '../../__tests__/helpers/project';

let project: TempProject;

const logged = (): string[] => vi.mocked(console.log).mock.calls.map(([message]) => String(message));

/** A Nest app whose flows share types in `src/projects/shared`, as the projects area keeps them. */
function nestProjectsArea(): void {
    writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' }, {}, { domainDriver: { featureRoot: 'src/projects' } });
    mkdir('src/projects');
    fs.writeFileSync(path.join(project.dir, 'src/projects/projects.module.ts'), 'export class ProjectsModule {}\n');
}

beforeEach(() => {
    project = createTempProject('feature-folder');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('a layer command into a feature folder that does not exist yet', () => {
    it('make:types creates the folder it writes into, and says so', () => {
        nestProjectsArea();
        makeTypes('shared', 'Project');
        expect(listFiles('src/projects/shared')).toEqual(['schemas/Project.schema.ts', 'types/Project.types.ts']);
        expect(logged()[0]).toBe(`✅ Feature folder "shared" created at ${path.join(process.cwd(), 'src/projects/shared')}`);
    });

    it('make:schema creates it too, with the DTOs on nest', () => {
        nestProjectsArea();
        makeSchema('shared', 'Project');
        expect(listFiles('src/projects/shared')).toEqual([
            'dto/CreateProject.dto.ts',
            'dto/UpdateProject.dto.ts',
            'schemas/CreateProject.schema.ts',
            'schemas/Project.schema.ts',
            'schemas/UpdateProject.schema.ts',
        ]);
    });

    it('says nothing about a folder that already exists', () => {
        nestProjectsArea();
        mkdir('src/projects/shared');
        makeTypes('shared', 'Project');
        expect(logged().some((line) => line.includes('Feature folder'))).toBe(false);
    });

    it('creates nothing when the command refuses before writing', () => {
        writePackageJson({ react: '1' });
        mkdir('src');
        expect(() => makeService('shared', 'Project')).toThrow('make:service is not available for the react stack.');
        expect(() => makeAction('shared', 'Project', 'find-active', { withInput: false, returns: 'list' })).toThrow(
            'Action name "find-active" must be camelCase or PascalCase'
        );
        expect(() => makeComponent('shared', 'ProjectCard', 'server')).toThrow('The react stack has no server components.');
        expect(projectFileExists('src/features/shared')).toBe(false);
        expect(logged().some((line) => line.includes('Feature folder'))).toBe(false);
    });

    it.each([
        ['make:service', () => makeService('shared', 'Project')],
        ['make:repository', () => makeRepository('shared', 'Project')],
        ['make:controller', () => makeController('shared', 'Project')],
        ['make:action', () => makeAction('shared', 'Project', 'listProject', { withInput: true, returns: 'list', method: 'get' })],
    ])('%s on nest names the make:feature to run first, since its classes need the module that writes', (command, run) => {
        nestProjectsArea();
        expect(run).toThrow(
            `Feature "shared" does not exist, and ${command} registers its classes in the feature's module, ` +
                'which make:feature writes and registers. Run first: domain-driver make:feature shared'
        );
        expect(projectFileExists('src/projects/shared')).toBe(false);
    });

    it.each([
        ['make:service', 'services/ListProject.service.ts', () => makeService('shared', 'Project')],
        ['make:repository', 'repositories/ListProject.repository.ts', () => makeRepository('shared', 'Project')],
        ['make:controller', 'controllers/ListProject.controller.ts', () => makeController('shared', 'Project')],
        ['make:action', 'controllers/FindActive.controller.ts', () => makeAction('shared', 'Project', 'findActive', { withInput: false, returns: 'list' })],
    ])('%s creates the folder on node, which has no module to register in', (_command, file, run) => {
        writePackageJson({ express: '1' });
        mkdir('src');
        run();
        expect(projectFileExists(`src/features/shared/${file}`)).toBe(true);
    });

    it.each([
        ['make:hook', 'hooks/ListProject.hook.ts', () => makeHook('shared', 'Project')],
        ['make:component', 'components/ProjectCard.tsx', () => makeComponent('shared', 'ProjectCard', 'client')],
        ['make:container', 'containers/ProjectContainer.tsx', () => makeContainer('shared', 'ProjectContainer')],
    ])('%s creates the folder on react', (_command, file, run) => {
        writePackageJson({ react: '1' });
        mkdir('src');
        run();
        expect(projectFileExists(`src/features/shared/${file}`)).toBe(true);
    });
});
