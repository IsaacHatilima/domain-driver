import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeAction, parseReturns } from '../action';
import { makeTypes } from '../types';
import {
    createTempProject,
    writePackageJson,
    mkdir,
    readProjectFile,
    projectFileExists,
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
        expect(logged()).toContain("ℹ️  Add to users.routes.ts: router.get('/find-active-users', findActiveUsersController);");
        expect(logged()).toContain('✅ Action "FindActiveUsers" scaffolded in "users"');
    });

    it('hints when the types file is missing and stays quiet when it exists', () => {
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(logged()).toContain('ℹ️  types/User.types.ts not found. Run: domain-driver make:types users/User');
        vi.mocked(console.log).mockClear();
        makeTypes('users', 'User');
        makeAction('users', 'User', 'countUsers', { withInput: false, returns: 'one' });
        expect(logged().some((line) => line.includes('types/User.types.ts not found'))).toBe(false);
    });

    it('writes a schema with --with-input and a 204 controller for void', () => {
        makeAction('users', 'User', 'notifyUsers', { withInput: true, returns: 'void' });
        expect(readProjectFile('src/features/users/schemas/NotifyUsers.schema.ts')).toContain('export const NotifyUsersSchema');
        const controller = readProjectFile('src/features/users/controllers/NotifyUsers.controller.ts');
        expect(controller).toContain('const parsed = NotifyUsersSchema.safeParse(req.body);');
        expect(controller).toContain('res.status(204).send();');
        expect(readProjectFile('src/features/users/repositories/NotifyUsers.repository.ts')).toContain('async handle(data: NotifyUsers): Promise<void> {');
        expect(logged()).toContain("ℹ️  Add to users.routes.ts: router.post('/notify-users', notifyUsersController);");
    });

    it('skips existing files', () => {
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "FindActiveUsers.service.ts" — already exists');
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
    it('writes both sides and a route handler at the slug', () => {
        writePackageJson({ next: '1' });
        mkdir('app/api');
        mkdir('app/users');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(projectFileExists('app/users/server/services/FindActiveUsers.service.ts')).toBe(true);
        expect(projectFileExists('app/users/server/repositories/FindActiveUsers.repository.ts')).toBe(true);
        expect(projectFileExists('app/users/client/services/FindActiveUsers.service.ts')).toBe(true);
        expect(readProjectFile('app/users/client/repositories/FindActiveUsers.repository.ts')).toContain("fetch('/api/users/find-active-users')");
        expect(readProjectFile('app/api/users/find-active-users/route.ts')).toContain('export async function GET(): Promise<NextResponse> {');
    });
});

describe('make:action on react', () => {
    it('writes the client side only', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/users');
        makeAction('users', 'User', 'findActiveUsers', { withInput: false, returns: 'list' });
        expect(projectFileExists('src/features/users/services/FindActiveUsers.service.ts')).toBe(true);
        expect(readProjectFile('src/features/users/repositories/FindActiveUsers.repository.ts')).toContain("fetch('/api/users/find-active-users')");
        expect(projectFileExists('src/features/users/controllers')).toBe(false);
    });
});
