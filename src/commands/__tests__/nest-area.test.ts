import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { makeAction } from '../action';
import { makeController } from '../controller';
import { makeFeature } from '../feature';
import { registerCustomAction } from '../register';
import { requireFeature } from '../resolve';
import { createTempProject, readProjectFile, writePackageJson, TempProject } from '../../__tests__/helpers/project';

const REPO = path.resolve(__dirname, '../../..');

let project: TempProject;

const logged = (): string[] => vi.mocked(console.log).mock.calls.map(([message]) => String(message));

function areaModule(area: string): string {
    const name = area.charAt(0).toUpperCase() + area.slice(1);
    return `import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class ${name}Module {}
`;
}

/** A Nest app whose flows live in `src/<area>`, scaffolded with `--root src/<area>`. */
function nestArea(area: string, autoRegister = true): void {
    writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' }, {}, { domainDriver: { featureRoot: `src/${area}`, autoRegister } });
    const modules = path.join(process.cwd(), 'node_modules');
    fs.mkdirSync(modules, { recursive: true });
    const typescript = path.join(modules, 'typescript');
    if (!fs.existsSync(typescript)) fs.symlinkSync(path.join(REPO, 'node_modules', 'typescript'), typescript, 'dir');
    fs.mkdirSync(path.join(process.cwd(), 'src', area), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'src', 'app.module.ts'), areaModule('app'));
    fs.writeFileSync(path.join(process.cwd(), 'src', area, `${area}.module.ts`), areaModule(area));
}

beforeEach(() => {
    project = createTempProject('nest-area');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('a flow in the projects area', () => {
    beforeEach(() => nestArea('projects'));

    it('routes createProject at POST /projects and registers the flow in the area module', async () => {
        await makeFeature('create-project');
        makeAction('create-project', 'Project', 'createProject', { withInput: true, returns: 'one', method: 'post' });

        const controller = readProjectFile('src/projects/create-project/controllers/CreateProject.controller.ts');
        expect(controller).toContain("@Controller('projects')");
        expect(controller).toContain('  @Post()\n  handle(@Body() body: CreateProjectDto): Promise<Project> {');
        expect(readProjectFile('src/projects/projects.module.ts')).toContain('CreateProjectModule');
        expect(logged()).toContain('ℹ️  CreateProjectController answers POST /projects');
    });

    it('routes archiveProject at POST /projects/:id/archive', async () => {
        await makeFeature('archive-project');
        makeAction('archive-project', 'Project', 'archiveProject', { withInput: false, returns: 'one', method: 'post', onRecord: true });

        const controller = readProjectFile('src/projects/archive-project/controllers/ArchiveProject.controller.ts');
        expect(controller).toContain("@Controller('projects')");
        expect(controller).toContain("@Post(':id/archive')");
        expect(logged()).toContain('ℹ️  ArchiveProjectController answers POST /projects/:id/archive');
    });

    it('warns that a literal GET must come before another flow answering GET /projects/:id', async () => {
        await makeFeature('find-active-projects');
        makeAction('find-active-projects', 'Project', 'findActiveProjects', { withInput: false, returns: 'list' });

        expect(logged()).toContain('ℹ️  FindActiveProjectsController answers GET /projects/find-active');
        expect(logged()).toContain(
            'ℹ️  If another flow in src/projects/projects.module.ts answers GET /projects/:id, import FindActiveProjectsModule ahead of it, or that route answers GET /projects/find-active.'
        );
    });

    it('does not warn for a route that GET /projects/:id cannot swallow', async () => {
        await makeFeature('archive-project');
        makeAction('archive-project', 'Project', 'archiveProject', { withInput: false, returns: 'one', method: 'post', onRecord: true });
        expect(logged().some((line) => line.includes('ahead of it'))).toBe(false);
    });

    it('prints the routes the standard five answer', async () => {
        await makeFeature('manage-projects');
        makeController('manage-projects', 'Project');
        expect(readProjectFile('src/projects/manage-projects/controllers/UpdateProject.controller.ts')).toContain("@Patch(':id')");
        expect(logged()).toContain(
            'ℹ️  The controllers answer GET /projects, GET /projects/:id, POST /projects, PATCH /projects/:id and DELETE /projects/:id'
        );
    });

    it('names the area module and the real route in the hints when registration is off', async () => {
        nestArea('projects', false);
        await makeFeature('archive-project');
        makeAction('archive-project', 'Project', 'archiveProject', { withInput: false, returns: 'one', method: 'post', onRecord: true });
        registerCustomAction(requireFeature('archive-project'), 'ArchiveProject', 'Project');
        const lines = logged().join('\n');
        expect(lines).toContain('ℹ️  Did not edit src/projects/projects.module.ts (automatic registration is off). Add by hand:');
        expect(lines).toContain("import { ArchiveProjectModule } from './archive-project/archive-project.module';");
        expect(lines).toContain("import { ArchiveProjectController } from './controllers/ArchiveProject.controller';");
        expect(lines).toContain('ℹ️  ArchiveProjectController answers POST /projects/:id/archive');
    });
});

describe('a flow in the auth area', () => {
    beforeEach(() => nestArea('auth'));

    it('routes login at POST /auth/login', async () => {
        await makeFeature('login');
        makeAction('login', 'Session', 'login', { withInput: true, returns: 'one', method: 'post' });

        const controller = readProjectFile('src/auth/login/controllers/Login.controller.ts');
        expect(controller).toContain("@Controller('auth')");
        expect(controller).toContain("  @Post('login')\n  @HttpCode(200)");
        expect(readProjectFile('src/auth/auth.module.ts')).toContain('LoginModule');
        expect(logged()).toContain('ℹ️  LoginController answers POST /auth/login');
        expect(logged().some((line) => line.includes('ahead of it'))).toBe(false);
    });
});

describe('a flow without an area module', () => {
    it('keeps the 0.10 route at the feature root and prints no route line', async () => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' }, {}, { domainDriver: { featureRoot: 'src/projects' } });
        await makeFeature('create-project');
        makeAction('create-project', 'Project', 'createProject', { withInput: true, returns: 'one', method: 'post' });

        const controller = readProjectFile('src/projects/create-project/controllers/CreateProject.controller.ts');
        expect(controller).toContain("@Controller('create-project')");
        expect(controller).toContain('  @Post()\n');
        expect(logged().some((line) => line.includes(' answers '))).toBe(false);
    });
});
