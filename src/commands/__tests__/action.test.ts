import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { makeAction, parseMethod, parseReturns } from '../action';
import { makeTypes } from '../types';
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

const logged = (): string[] => vi.mocked(console.log).mock.calls.map(([message]) => String(message));

beforeEach(() => {
    project = createTempProject('action');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('parseReturns', () => {
    it('accepts the three kinds and rejects others', () => {
        expect(parseReturns('list')).toBe('list');
        expect(parseReturns('one')).toBe('one');
        expect(parseReturns('void')).toBe('void');
        expect(() => parseReturns('many')).toThrow('Invalid --returns "many". Use list, one, or void.');
    });
});

describe('parseMethod', () => {
    it('accepts the five methods in any case and rejects others', () => {
        for (const method of ['get', 'post', 'put', 'patch', 'delete']) expect(parseMethod(method)).toBe(method);
        expect(parseMethod('PATCH')).toBe('patch');
        expect(() => parseMethod('fetch')).toThrow('Invalid --method "fetch". Use get, post, put, patch, or delete.');
    });
});

describe('make:action on one record', () => {
    it('writes a PATCH mutation hook on react', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/projects');
        makeAction('projects', 'Project', 'archiveProject', { withInput: false, returns: 'one', method: 'patch', onRecord: true });
        const hook = readProjectFile('src/features/projects/hooks/ArchiveProject.hook.ts');
        expect(hook).toContain('const archiveProject = useCallback(async (id: string) => {');
        expect(hook).toContain("method: 'PATCH',");
        expect(hook).not.toContain('useEffect');
    });

    it('passes the id from controller to repository and prints the record route on express', () => {
        writePackageJson({ express: '1' });
        mkdir('src/features/projects');
        makeAction('projects', 'Project', 'archiveProject', { withInput: false, returns: 'one', method: 'patch', onRecord: true });
        expect(readProjectFile('src/features/projects/controllers/ArchiveProject.controller.ts')).toContain('service.handle(req.params.id)');
        expect(readProjectFile('src/features/projects/services/ArchiveProject.service.ts')).toContain('async handle(id: string): Promise<Project> {');
        expect(readProjectFile('src/features/projects/repositories/ArchiveProject.repository.ts')).toContain('async handle(id: string): Promise<Project> {');
        expect(logged()).toContain(
            "ℹ️  Add to projects.routes.ts: router.patch('/:id/archive-project', archiveProjectController);"
        );
    });

    it('writes the route handler under [id] on next-fullstack with --route', () => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        mkdir('app/projects');
        makeAction('projects', 'Project', 'archiveProject', { withInput: false, returns: 'one', method: 'patch', onRecord: true, route: true });
        expect(readProjectFile('app/api/projects/[id]/archive-project/route.ts')).toContain('export async function PATCH(');
        expect(projectFileExists('app/api/projects/:id')).toBe(false);
    });

    it('rejects a GET with a body before writing anything', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/users');
        expect(() => makeAction('users', 'User', 'searchUsers', { withInput: true, returns: 'list', method: 'get' })).toThrow(
            'A GET action cannot take a request body.'
        );
        expect(listFiles('src/features/users')).toEqual([]);
    });
});

describe('make:action in a feature that is the action itself', () => {
    it('routes a Nest create at the controller root with the default 201', () => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' }, {}, { domainDriver: { featureRoot: 'src/projects' } });
        mkdir('src/projects/create-project');
        makeAction('create-project', 'Project', 'createProject', { withInput: true, returns: 'one' });
        const controller = readProjectFile('src/projects/create-project/controllers/CreateProject.controller.ts');
        expect(controller).toContain("@Controller('create-project')");
        expect(controller).toContain('@Post()\n  handle(@Body() body: CreateProjectDto): Promise<Project> {');
        expect(controller).not.toContain('HttpCode');
    });

    it('prints a root route line on express', () => {
        writePackageJson({ express: '1' });
        mkdir('src/features/create-project');
        makeAction('create-project', 'Project', 'createProject', { withInput: true, returns: 'one' });
        expect(logged()).toContain(
            "ℹ️  Add to create-project.routes.ts: router.post('/', createProjectController);"
        );
    });
});

describe('make:action on node with express', () => {
    beforeEach(() => {
        writePackageJson({ express: '1' });
        mkdir('src/features/users');
    });

    it('writes service, repository, controller and prints the route line', () => {
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(readProjectFile('src/features/users/services/FindActiveUsers.service.ts')).toContain('export class FindActiveUsersService {');
        expect(readProjectFile('src/features/users/repositories/FindActiveUsers.repository.ts')).toContain('is not implemented');
        expect(readProjectFile('src/features/users/controllers/FindActiveUsers.controller.ts')).toContain('export async function findActiveUsersController(_req: Request');
        expect(projectFileExists('src/features/users/schemas')).toBe(false);
        expect(logged()).toContain(
            "ℹ️  Add to users.routes.ts above the '/:id' routes: router.get('/find-active-users', findActiveUsersController);"
        );
        expect(logged()).toContain('✅ Action "FindActiveUsers" scaffolded in "users"');
    });

    it('hints when the types file is missing and stays quiet when it exists', () => {
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(logged()).toContain(
            'ℹ️  types/User.types.ts and schemas/User.schema.ts not found. Run: domain-driver make:types users/User'
        );
        vi.mocked(console.log).mockClear();
        makeTypes('users', 'User');
        makeAction('users', 'User', 'countUsers', { withInput: false, returns: 'one' });
        expect(logged().some((line) => line.includes('not found'))).toBe(false);
    });

    it('names only the entity schema when the types file predates it', () => {
        mkdir('src/features/users/types');
        fs.writeFileSync(path.join(process.cwd(), 'src/features/users/types/User.types.ts'), 'export interface User { id: string }\n');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(logged()).toContain('ℹ️  schemas/User.schema.ts not found. Run: domain-driver make:types users/User');
    });

    it('writes a schema with --with-input and a 204 controller for void', () => {
        makeAction('users', 'User', 'notifyUsers', { withInput: true, returns: 'void' });
        expect(readProjectFile('src/features/users/schemas/NotifyUsers.schema.ts')).toContain('export const NotifyUsersSchema');
        const controller = readProjectFile('src/features/users/controllers/NotifyUsers.controller.ts');
        expect(controller).toContain('const parsed = NotifyUsersSchema.safeParse(req.body);');
        expect(controller).toContain('res.status(204).send();');
        expect(readProjectFile('src/features/users/repositories/NotifyUsers.repository.ts')).toContain('async handle(data: NotifyUsers): Promise<void> {');
        expect(logged()).toContain(
            "ℹ️  Add to users.routes.ts above the '/:id' routes: router.post('/notify-users', notifyUsersController);"
        );
    });

    it('skips existing files', () => {
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        vi.mocked(console.log).mockClear();
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "FindActiveUsers.service.ts" — already exists');
        expect(logged().some((line) => line.includes('✅ Action "FindActiveUsers" scaffolded'))).toBe(false);
        expect(logged().some((line) => line.includes('routes.ts'))).toBe(false);
    });

    it('rejects a bad action name before writing', () => {
        expect(() => makeAction('users', 'User', 'find-active', { withInput: false, returns: 'list' })).toThrow(
            'Action name "find-active" must be camelCase or PascalCase, for example findActiveUsers.'
        );
        expect(projectFileExists('src/features/users/services')).toBe(false);
    });
});

describe('make:action on node without a framework', () => {
    it('writes a generic controller and no route hint', () => {
        writePackageJson({});
        mkdir('src/features/users');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(readProjectFile('src/features/users/controllers/FindActiveUsers.controller.ts')).toContain('export class FindActiveUsersController {');
        expect(logged().some((line) => line.includes('routes.ts'))).toBe(false);
    });
});

describe('make:action on nest', () => {
    it('writes injectable classes and a DTO with input', () => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' });
        mkdir('src/users');
        makeAction('users', 'User', 'archiveUser', { withInput: true, returns: 'one' });
        expect(readProjectFile('src/users/dto/ArchiveUser.dto.ts')).toContain('createZodDto(ArchiveUserSchema)');
        const controller = readProjectFile('src/users/controllers/ArchiveUser.controller.ts');
        expect(controller).toContain("@Post('archive-user')\n  @HttpCode(200)");
        expect(readProjectFile('src/users/services/ArchiveUser.service.ts')).toContain('@Injectable()');
    });
});

describe('make:action on next-fullstack', () => {
    it('writes the server side, a route handler at the slug and a hook that fetches it with --route', () => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        mkdir('app/users');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list', route: true });
        expect(projectFileExists('app/users/server/services/FindActiveUsers.service.ts')).toBe(true);
        expect(projectFileExists('app/users/server/repositories/FindActiveUsers.repository.ts')).toBe(true);
        expect(readProjectFile('app/api/users/find-active-users/route.ts')).toContain('export async function GET(): Promise<NextResponse> {');
        expect(readProjectFile('app/users/hooks/FindActiveUsers.hook.ts')).toContain("fetch('/api/users/find-active-users', { signal: controller.signal })");
        expect(projectFileExists('app/users/client')).toBe(false);
    });
});

describe('make:action on react', () => {
    it('writes a hook that calls the API and no service or repository', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/users');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(readProjectFile('src/features/users/hooks/FindActiveUsers.hook.ts')).toContain("fetch('/api/users/find-active-users', { signal: controller.signal })");
        expect(projectFileExists('src/features/users/services')).toBe(false);
        expect(projectFileExists('src/features/users/repositories')).toBe(false);
        expect(projectFileExists('src/features/users/controllers')).toBe(false);
        expect(listFiles('src/features/users')).toEqual(['hooks/FindActiveUsers.hook.ts']);
    });

    it('writes a schema and a posting hook with --with-input', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/users');
        makeAction('users', 'User', 'notifyUsers', { withInput: true, returns: 'void' });
        const hook = readProjectFile('src/features/users/hooks/NotifyUsers.hook.ts');
        expect(hook).toContain("fetch('/api/users/notify-users', {");
        expect(hook).toContain("method: 'POST',");
        expect(hook).toContain('body: JSON.stringify(data),');
        expect(readProjectFile('src/features/users/schemas/NotifyUsers.schema.ts')).toContain('export const NotifyUsersSchema');
        expect(listFiles('src/features/users')).toEqual([
            'hooks/NotifyUsers.hook.ts',
            'schemas/NotifyUsers.schema.ts',
        ]);
    });
});

describe('make:action writes a hook', () => {
    it('writes a hook for a custom action on react', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/users');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        const content = readProjectFile('src/features/users/hooks/FindActiveUsers.hook.ts');
        expect(content).toContain('export function useFindActiveUsers()');
        expect(content).toContain('loading: result?.request !== request,');
    });

    it('writes a Query hook for a custom action on tanstack-start', () => {
        writePackageJson({ '@tanstack/react-start': '1', react: '1' });
        mkdir('src/routes/users');
        makeAction('users', 'User', 'notifyUsers', { withInput: true, returns: 'void' });
        const content = readProjectFile('src/routes/users/-hooks/NotifyUsers.hook.ts');
        expect(content).toContain('useMutation');
        expect(content).toContain("import { notifyUsers } from '../-server/functions/NotifyUsers.fn';");
        expect(content).not.toContain('new NotifyUsersService()');
    });

    it('writes no hook on a stack without the layer', () => {
        writePackageJson({});
        mkdir('src/features/users');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(projectFileExists('src/features/users/hooks/FindActiveUsers.hook.ts')).toBe(false);
    });

    it('does not warn when a second custom action re-ensures the shared keys file on tanstack-start', () => {
        writePackageJson({ '@tanstack/react-start': '1', react: '1' });
        mkdir('src/routes/users');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        vi.mocked(console.warn).mockClear();

        makeAction('users', 'User', 'countUsers', { withInput: false, returns: 'one' });

        expect(console.warn).not.toHaveBeenCalled();
        expect(readProjectFile('src/routes/users/-hooks/users.keys.ts')).toContain('export const usersKeys');
    });
});
