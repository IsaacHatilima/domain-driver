import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { makeAction } from '../action';
import { makeContainer } from '../container';
import { makeController } from '../controller';
import { makeFeature } from '../feature';
import { makeHook } from '../hook';
import { makeService } from '../service';
import {
    createTempProject,
    writePackageJson,
    mkdir,
    listFiles,
    projectFileExists,
    readProjectFile,
    TempProject,
} from '../../__tests__/helpers/project';

let project: TempProject;

const logged = (): string[] => vi.mocked(console.log).mock.calls.map(([message]) => String(message));

const ACTIONS = ['List', 'Show', 'Create', 'Update', 'Delete'];
const perAction = (dir: string, suffix: string): string[] => ACTIONS.map((action) => `${dir}/${action}Project.${suffix}.ts`);

/** Every relative import in the tree points at a file that exists. */
function assertImportsResolve(relativeRoot: string): void {
    for (const file of listFiles(relativeRoot)) {
        const absolute = path.join(process.cwd(), relativeRoot, file);
        for (const match of fs.readFileSync(absolute, 'utf-8').matchAll(/from '(\.[^']+)'/g)) {
            const target = path.resolve(path.dirname(absolute), match[1]);
            const exists = fs.existsSync(`${target}.ts`) || fs.existsSync(`${target}.tsx`);
            expect(exists, `${file} imports missing ${match[1]}`).toBe(true);
        }
    }
}

/** A Next 16 app that reads and writes through Drizzle and has no app/api folder. */
function serverActionsApp(): void {
    writePackageJson({ next: '16.0.0', react: '19.0.0', 'drizzle-orm': '1', zod: '4' });
    mkdir('app');
}

beforeEach(() => {
    project = createTempProject('server-actions');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('make:feature -a on next-fullstack', () => {
    beforeEach(serverActionsApp);

    it('writes Server Actions for the writes and no route handler or fetch hook', async () => {
        await makeFeature('projects', true, 'Project');
        expect(listFiles('app')).toEqual(
            [
                'projects/components/client/Project.tsx',
                'projects/containers/ProjectContainer.tsx',
                'projects/page.tsx',
                'projects/schemas/CreateProject.schema.ts',
                'projects/schemas/Project.schema.ts',
                'projects/schemas/UpdateProject.schema.ts',
                'projects/server/actions/CreateProject.action.ts',
                'projects/server/actions/DeleteProject.action.ts',
                'projects/server/actions/UpdateProject.action.ts',
                ...perAction('projects/server/repositories', 'repository'),
                ...perAction('projects/server/services', 'service'),
                'projects/types/Project.types.ts',
            ].sort()
        );
        expect(projectFileExists('app/api')).toBe(false);
        expect(projectFileExists('app/projects/hooks')).toBe(false);
        assertImportsResolve('app');
    });

    it('reads in an async Server Component container that calls the List service', async () => {
        await makeFeature('projects', true, 'Project');
        const container = readProjectFile('app/projects/containers/ProjectContainer.tsx');
        expect(container).not.toContain("'use client'");
        expect(container).toContain('export default async function ProjectContainer() {');
        expect(container).toContain("import { ListProjectService } from '../server/services/ListProject.service';");
        expect(container).toContain('const data = await service.handle();');
        expect(container).toContain('<Project key={item.id} {...item} />');
        expect(readProjectFile('app/projects/page.tsx')).toContain("import ProjectContainer from './containers/ProjectContainer';");
    });

    it('gives each write a use-server action that fails closed, and names the line to replace', async () => {
        await makeFeature('projects', true, 'Project');
        const create = readProjectFile('app/projects/server/actions/CreateProject.action.ts');
        expect(create.startsWith("'use server';\n")).toBe(true);
        expect(create).toContain('export async function createProjectAction(');
        expect(create).toContain("throw new Error('createProjectAction does not check the caller yet');");
        expect(readProjectFile('app/projects/server/actions/DeleteProject.action.ts')).toContain(
            "ProjectSchema.shape.id.safeParse(formData.get('id'))"
        );
        const hint = logged().find((line) => line.includes('requireCaller'));
        expect(hint).toBe(
            'ℹ️  Server Actions fail closed until they check the caller. In app/projects/server/actions/CreateProject.action.ts, ' +
                'app/projects/server/actions/UpdateProject.action.ts and app/projects/server/actions/DeleteProject.action.ts, ' +
                'replace "await requireCaller();" with your session check (for example: const { user } = await requireSession();) ' +
                'and delete requireCaller().'
        );
    });

    it('creates a server/actions folder in place of hooks without -a', async () => {
        await makeFeature('projects');
        const files = listFiles('app/projects');
        expect(files).toContain('server/actions/.gitkeep');
        expect(files).not.toContain('hooks/.gitkeep');
    });
});

describe('make:feature -a --route on next-fullstack', () => {
    beforeEach(serverActionsApp);

    it('keeps the route handlers, fetch hooks and client container', async () => {
        await makeFeature('projects', true, 'Project', { route: true });
        const files = listFiles('app');
        expect(files).toContain('api/projects/route.ts');
        expect(files).toContain('api/projects/[id]/route.ts');
        expect(files).toEqual(expect.arrayContaining(perAction('projects/hooks', 'hook')));
        expect(files.some((file) => file.includes('server/actions'))).toBe(false);
        const container = readProjectFile('app/projects/containers/ProjectContainer.tsx');
        expect(container.startsWith("'use client';")).toBe(true);
        expect(container).toContain("import { useListProject } from '../hooks/ListProject.hook';");
        expect(logged().some((line) => line.includes('requireCaller'))).toBe(false);
        assertImportsResolve('app');
    });

    it('creates hooks in place of server/actions without -a', async () => {
        await makeFeature('projects', false, 'Project', { route: true });
        const files = listFiles('app/projects');
        expect(files).toContain('hooks/.gitkeep');
        expect(files).not.toContain('server/actions/.gitkeep');
    });
});

describe('make:action on next-fullstack', () => {
    beforeEach(async () => {
        serverActionsApp();
        await makeFeature('projects', true, 'Project');
        vi.mocked(console.log).mockClear();
    });

    it('writes a Server Action for a write on one record, with the id from the form', () => {
        makeAction('projects', 'Project', 'archiveProject', { withInput: false, returns: 'one', method: 'post', onRecord: true });
        const files = listFiles('app');
        expect(files).toContain('projects/server/actions/ArchiveProject.action.ts');
        expect(files).toContain('projects/server/services/ArchiveProject.service.ts');
        expect(files).toContain('projects/server/repositories/ArchiveProject.repository.ts');
        expect(files.some((file) => file.startsWith('api/'))).toBe(false);
        expect(files.some((file) => file.includes('hooks/'))).toBe(false);
        const action = readProjectFile('app/projects/server/actions/ArchiveProject.action.ts');
        expect(action).toContain('export async function archiveProjectAction(');
        expect(action).toContain("const id = ProjectSchema.shape.id.safeParse(formData.get('id'));");
        expect(action).toContain('await service.handle(id.data);');
        expect(readProjectFile('app/projects/server/services/ArchiveProject.service.ts')).toContain('async handle(id: string): Promise<Project> {');
        expect(logged().some((line) => line.includes('"await requireCaller();"') && line.includes('ArchiveProject.action.ts'))).toBe(true);
        assertImportsResolve('app');
    });

    it('writes the input schema and validates the form with it', () => {
        makeAction('projects', 'Project', 'inviteMember', { withInput: true, returns: 'one' });
        expect(projectFileExists('app/projects/schemas/InviteMember.schema.ts')).toBe(true);
        expect(readProjectFile('app/projects/server/actions/InviteMember.action.ts')).toContain(
            'InviteMemberSchema.safeParse(Object.fromEntries(formData))'
        );
    });

    it('writes only the service and repository for a read, and says where to call it', () => {
        makeAction('projects', 'Project', 'findActiveProjects', { withInput: false, returns: 'list' });
        const files = listFiles('app');
        expect(files).toContain('projects/server/services/FindActiveProjects.service.ts');
        expect(files).toContain('projects/server/repositories/FindActiveProjects.repository.ts');
        expect(files).not.toContain('projects/server/actions/FindActiveProjects.action.ts');
        expect(files.some((file) => file.startsWith('api/'))).toBe(false);
        expect(files.some((file) => file.includes('hooks/'))).toBe(false);
        expect(logged()).toContain(
            'ℹ️  FindActiveProjects is a read: call FindActiveProjectsService from a Server Component, such as a container. ' +
                'It gets no Server Action; pass --route for a route handler and fetch hook.'
        );
    });

    it('reads a GET with input from the page searchParams in a container that hands them to the service', () => {
        makeAction('projects', 'Project', 'searchProjects', { withInput: true, returns: 'list', method: 'get' });
        const files = listFiles('app');
        expect(files).toContain('projects/schemas/SearchProjects.schema.ts');
        expect(files).toContain('projects/server/services/SearchProjects.service.ts');
        expect(files).toContain('projects/server/repositories/SearchProjects.repository.ts');
        expect(files).toContain('projects/containers/SearchProjectsContainer.tsx');
        expect(files).not.toContain('projects/server/actions/SearchProjects.action.ts');
        expect(files.some((file) => file.startsWith('api/'))).toBe(false);
        expect(readProjectFile('app/projects/server/services/SearchProjects.service.ts')).toContain(
            'async handle(query: SearchProjects): Promise<Project[]> {'
        );
        const container = readProjectFile('app/projects/containers/SearchProjectsContainer.tsx');
        expect(container).toContain('export default async function SearchProjectsContainer({ searchParams }: SearchProjectsContainerProps) {');
        expect(container).toContain('const parsed = SearchProjectsSchema.safeParse(await searchParams);');
        expect(container).toContain('const data = await service.handle(parsed.data);');
        expect(container).toContain('<Project key={item.id} {...item} />');
        expect(logged()).toContain(
            "ℹ️  SearchProjects is a read that takes its input from the query string: SearchProjectsContainer parses the page's searchParams " +
                'with SearchProjectsSchema and calls SearchProjectsService. Render it from the page with the page\'s own prop: ' +
                '<SearchProjectsContainer searchParams={searchParams} />'
        );
        assertImportsResolve('app');
    });

    it('keeps a container that exists, and writes none for a void GET with input', () => {
        makeAction('projects', 'Project', 'searchProjects', { withInput: true, returns: 'list', method: 'get' });
        vi.mocked(console.warn).mockClear();
        makeAction('projects', 'Project', 'searchProjects', { withInput: true, returns: 'list', method: 'get' });
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "SearchProjectsContainer.tsx" — already exists');
        makeAction('projects', 'Project', 'exportProjects', { withInput: true, returns: 'void', method: 'get' });
        expect(projectFileExists('app/projects/containers/ExportProjectsContainer.tsx')).toBe(false);
        expect(logged()).toContain(
            'ℹ️  ExportProjects is a read: call ExportProjectsService from a Server Component, such as a container, ' +
                "with the page's searchParams parsed by ExportProjectsSchema. " +
                'It gets no Server Action; pass --route for a route handler and fetch hook.'
        );
    });

    it('reads the search params in the route handler and sends them from the hook with --route', () => {
        makeAction('projects', 'Project', 'searchProjects', { withInput: true, returns: 'list', method: 'get', route: true });
        expect(readProjectFile('app/api/projects/search-projects/route.ts')).toContain(
            'const parsed = SearchProjectsSchema.safeParse(query);'
        );
        expect(readProjectFile('app/projects/hooks/SearchProjects.hook.ts')).toContain(
            'fetch(`/api/projects/search-projects${search}`, { signal: controller.signal })'
        );
        expect(projectFileExists('app/projects/containers/SearchProjectsContainer.tsx')).toBe(false);
    });

    it('writes the route handler and fetch hook with --route', () => {
        makeAction('projects', 'Project', 'archiveProject', { withInput: false, returns: 'one', method: 'patch', onRecord: true, route: true });
        expect(readProjectFile('app/api/projects/[id]/archive-project/route.ts')).toContain('export async function PATCH(');
        expect(readProjectFile('app/projects/hooks/ArchiveProject.hook.ts')).toContain("method: 'PATCH',");
        expect(projectFileExists('app/projects/server/actions/ArchiveProject.action.ts')).toBe(false);
    });
});

describe('make:controller on next-fullstack', () => {
    beforeEach(() => {
        serverActionsApp();
        mkdir('app/projects');
    });

    it('writes the three write actions by default', () => {
        makeController('projects', 'Project');
        expect(listFiles('app/projects/server/actions')).toEqual([
            'CreateProject.action.ts',
            'DeleteProject.action.ts',
            'UpdateProject.action.ts',
        ]);
        expect(projectFileExists('app/api')).toBe(false);
        expect(logged()).toContain(`✅ Server Actions for "Project" created at ${path.join(process.cwd(), 'app/projects/server/actions')}`);
    });

    it('writes the route handlers with --route', () => {
        makeController('projects', 'Project', { route: true });
        expect(readProjectFile('app/api/projects/route.ts')).toContain('export async function POST');
        expect(projectFileExists('app/projects/server/actions')).toBe(false);
    });
});

describe('make:container on next-fullstack', () => {
    beforeEach(() => {
        serverActionsApp();
        mkdir('app/projects');
    });

    it('is a Server Component over the List service when the feature has one', () => {
        makeService('projects', 'Project');
        makeContainer('projects', 'ProjectContainer');
        const content = readProjectFile('app/projects/containers/ProjectContainer.tsx');
        expect(content).toContain('export default async function ProjectContainer() {');
        expect(content).toContain('await connection();');
    });

    it('keeps the client container over the List hook in a feature served by route handlers', () => {
        makeService('projects', 'Project');
        makeHook('projects', 'Project');
        makeContainer('projects', 'ProjectContainer');
        const content = readProjectFile('app/projects/containers/ProjectContainer.tsx');
        expect(content.startsWith("'use client';")).toBe(true);
        expect(content).toContain('useListProject()');
    });

    it('calls no service for a name without a List service, and names the services there are', () => {
        makeService('projects', 'Project');
        vi.mocked(console.log).mockClear();
        makeContainer('projects', 'ProjectDetailContainer');
        expect(readProjectFile('app/projects/containers/ProjectDetailContainer.tsx')).toContain(
            'export default async function ProjectDetailContainer() {'
        );
        expect(logged()).toContain(
            'ℹ️  server/services/ListProjectDetail.service.ts not found, so ProjectDetailContainer calls no service yet. ' +
                "Call one of the feature's services in it: CreateProjectService, DeleteProjectService, ListProjectService, ShowProjectService, UpdateProjectService."
        );
    });

    it('says how to generate services when the feature has none', () => {
        makeContainer('projects', 'ProjectDetailContainer');
        expect(logged()).toContain(
            'ℹ️  server/services/ListProjectDetail.service.ts not found, so ProjectDetailContainer calls no service yet. ' +
                'Generate the services with: domain-driver make:service projects/<Entity>'
        );
    });
});

describe('make:hook on next-fullstack without route handlers', () => {
    it('says the hooks need the route handlers they fetch', () => {
        serverActionsApp();
        mkdir('app/projects');
        makeHook('projects', 'Project');
        expect(logged()).toContain(
            'ℹ️  These hooks fetch /api/projects, which has no route handler yet. Run: domain-driver make:controller projects/Project --route'
        );
    });
});

describe('--route on a stack without Server Actions', () => {
    it('changes nothing and says so', async () => {
        writePackageJson({ express: '1' });
        mkdir('src');
        await makeFeature('projects', true, 'Project', { route: true });
        expect(listFiles('src/features/projects')).toContain('controllers/CreateProject.controller.ts');
        expect(logged()).toContain('ℹ️  --route only changes next-fullstack output; the node stack is unchanged.');
    });
});
