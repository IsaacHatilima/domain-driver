import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderNestController } from '../controllers/nest';
import { customAction, standardAction } from '../actions';
import { renderDto } from '../nest/dto';
import { renderModule } from '../nest/module';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, mkdir, TempProject } from '../../__tests__/helpers/project';
import * as fs from 'fs';
import { RenderContext } from '../context';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('nest-templates');
});

afterEach(() => project.cleanup());

const ctx = () => contextFor('nest', 'coffee-type');
const controllerFile = (action: string): string =>
    path.join(ctx().featureDir, 'controllers', `${action}CoffeeType.controller.ts`);

describe('renderNestController', () => {
    it('renders a single-action Post controller with a DTO body', () => {
        const content = renderNestController(ctx(), standardAction('Create', 'CoffeeType'), 'CoffeeType', controllerFile('Create'));
        expect(content).toContain("import { Body, Controller, Post } from '@nestjs/common';");
        expect(content).toContain("import type { CoffeeType } from '../types/CoffeeType.types';");
        expect(content).toContain("import { CreateCoffeeTypeDto } from '../dto/CreateCoffeeType.dto';");
        expect(content).toContain("import { CreateCoffeeTypeService } from '../services/CreateCoffeeType.service';");
        expect(content).toContain("@Controller('coffee-type')");
        expect(content).toContain('export class CreateCoffeeTypeController {');
        expect(content).toContain('constructor(private readonly service: CreateCoffeeTypeService) {}');
        expect(content).toContain('@Post()');
        expect(content).toContain('handle(@Body() body: CreateCoffeeTypeDto): Promise<CoffeeType> {');
        expect(content).toContain('return this.service.handle(body);');
    });

    it('renders Get with a param on show', () => {
        const content = renderNestController(ctx(), standardAction('Show', 'CoffeeType'), 'CoffeeType', controllerFile('Show'));
        expect(content).toContain("import { Controller, Get, Param } from '@nestjs/common';");
        expect(content).toContain("@Get(':id')");
        expect(content).toContain("handle(@Param('id') id: string): Promise<CoffeeType> {");
        expect(content).not.toContain('Dto');
    });

    it('renders list without params', () => {
        const content = renderNestController(ctx(), standardAction('List', 'CoffeeType'), 'CoffeeType', controllerFile('List'));
        expect(content).toContain("import { Controller, Get } from '@nestjs/common';");
        expect(content).toContain('@Get()');
        expect(content).toContain('handle(): Promise<CoffeeType[]> {');
    });

    it('renders Put with param and body on update', () => {
        const content = renderNestController(ctx(), standardAction('Update', 'CoffeeType'), 'CoffeeType', controllerFile('Update'));
        expect(content).toContain("import { Body, Controller, Param, Put } from '@nestjs/common';");
        expect(content).toContain("@Put(':id')");
        expect(content).toContain("handle(@Param('id') id: string, @Body() body: UpdateCoffeeTypeDto): Promise<CoffeeType> {");
        expect(content).toContain('return this.service.handle(id, body);');
    });

    it('renders Delete with a 204', () => {
        const content = renderNestController(ctx(), standardAction('Delete', 'CoffeeType'), 'CoffeeType', controllerFile('Delete'));
        expect(content).toContain("import { Controller, Delete, HttpCode, Param } from '@nestjs/common';");
        expect(content).toContain("@Delete(':id')");
        expect(content).toContain('@HttpCode(204)');
        expect(content).toContain("handle(@Param('id') id: string): Promise<void> {");
        expect(content).not.toContain('types/CoffeeType.types');
    });
});

describe('renderDto', () => {
    it('derives the class from the schema', () => {
        const fromFile = path.join(ctx().featureDir, 'dto', 'CreateCoffeeType.dto.ts');
        const content = renderDto(ctx(), 'CreateCoffeeType', fromFile);
        expect(content).toBe(`import { createZodDto } from 'nestjs-zod';
import { CreateCoffeeTypeSchema } from '../schemas/CreateCoffeeType.schema';

export class CreateCoffeeTypeDto extends createZodDto(CreateCoffeeTypeSchema) {}
`);
    });
});

describe('renderModule', () => {
    const moduleFile = (): string => path.join(ctx().featureDir, 'coffee-type.module.ts');

    it('renders an empty module', () => {
        const content = renderModule(ctx(), 'CoffeeType', moduleFile(), false);
        expect(content).toBe(`import { Module } from '@nestjs/common';

@Module({
  controllers: [],
  providers: [],
})
export class CoffeeTypeModule {}
`);
    });

    it('names the module after the feature folder, not the entity', () => {
        const flow = contextFor('nest', 'create-project');
        const content = renderModule(flow, 'Project', path.join(flow.featureDir, 'create-project.module.ts'), true);
        expect(content).toContain('export class CreateProjectModule {}');
        expect(content).not.toContain('class ProjectModule');
        expect(content).toContain("import { ListProjectController } from './controllers/ListProject.controller';");
    });

    it('registers five controllers and ten providers when populated', () => {
        const content = renderModule(ctx(), 'CoffeeType', moduleFile(), true);
        expect(content).toContain("import { ListCoffeeTypeController } from './controllers/ListCoffeeType.controller';");
        expect(content).toContain("import { DeleteCoffeeTypeService } from './services/DeleteCoffeeType.service';");
        expect(content).toContain("import { UpdateCoffeeTypeRepository } from './repositories/UpdateCoffeeType.repository';");
        expect(content).toContain(
            '  controllers: [\n    ListCoffeeTypeController,\n    ShowCoffeeTypeController,\n    CreateCoffeeTypeController,\n    UpdateCoffeeTypeController,\n    DeleteCoffeeTypeController,\n  ],'
        );
        expect(content).toContain('    ListCoffeeTypeService,\n');
        expect(content).toContain('    DeleteCoffeeTypeRepository,\n  ],');
        expect(content).toContain('export class CoffeeTypeModule {}');
    });
});

describe('renderNestController for custom actions', () => {
    it('POST returning 200 sets HttpCode explicitly', () => {
        const spec = customAction('CoffeeType', 'archiveCoffeeType', { withInput: true, returns: 'one' });
        const content = renderNestController(ctx(), spec, 'CoffeeType', controllerFile('Archive'));
        expect(content).toContain("import { Body, Controller, HttpCode, Post } from '@nestjs/common';");
        expect(content).toContain("import { ArchiveCoffeeTypeDto } from '../dto/ArchiveCoffeeType.dto';");
        expect(content).toContain('export class ArchiveCoffeeTypeController {');
        expect(content).toContain("@Post('archive-coffee-type')\n  @HttpCode(200)");
        expect(content).toContain('handle(@Body() body: ArchiveCoffeeTypeDto): Promise<CoffeeType> {');
    });

    it('GET returning a list needs no HttpCode', () => {
        const spec = customAction('CoffeeType', 'findActive', { withInput: false, returns: 'list' });
        const content = renderNestController(ctx(), spec, 'CoffeeType', controllerFile('FindActive'));
        expect(content).toContain("import { Controller, Get } from '@nestjs/common';");
        expect(content).toContain("@Get('find-active')\n  handle(): Promise<CoffeeType[]> {");
    });

    it('GET returning void sets 204', () => {
        const spec = customAction('CoffeeType', 'purge', { withInput: false, returns: 'void' });
        const content = renderNestController(ctx(), spec, 'CoffeeType', controllerFile('Purge'));
        expect(content).toContain("@Get('purge')\n  @HttpCode(204)");
        expect(content).not.toContain('types/CoffeeType.types');
    });

    it('PATCH on one record takes the id from the path', () => {
        const spec = customAction('CoffeeType', 'archiveCoffeeType', { withInput: false, returns: 'one', method: 'patch', onRecord: true });
        const content = renderNestController(ctx(), spec, 'CoffeeType', controllerFile('Archive'));
        expect(content).toContain("import { Controller, Param, Patch } from '@nestjs/common';");
        expect(content).toContain("@Controller('coffee-type')");
        expect(content).toContain("@Patch(':id/archive-coffee-type')\n  handle(@Param('id') id: string): Promise<CoffeeType> {");
        expect(content).toContain('return this.service.handle(id);');
        expect(content).not.toContain('HttpCode');
    });

    it('PUT on one record takes the id and the body', () => {
        const spec = customAction('CoffeeType', 'renameCoffeeType', { withInput: true, returns: 'one', method: 'put', onRecord: true });
        const content = renderNestController(ctx(), spec, 'CoffeeType', controllerFile('Rename'));
        expect(content).toContain("@Put(':id/rename-coffee-type')");
        expect(content).toContain(
            "handle(@Param('id') id: string, @Body() body: RenameCoffeeTypeDto): Promise<CoffeeType> {"
        );
        expect(content).toContain('return this.service.handle(id, body);');
    });

    it('DELETE on one record returning void sets 204', () => {
        const spec = customAction('CoffeeType', 'purgeCoffeeType', { withInput: false, returns: 'void', method: 'delete', onRecord: true });
        const content = renderNestController(ctx(), spec, 'CoffeeType', controllerFile('Purge'));
        expect(content).toContain("@Delete(':id/purge-coffee-type')\n  @HttpCode(204)");
    });
});

describe('renderNestController in a feature that is the action itself', () => {
    const flow = () => contextFor('nest', 'create-project');
    const file = (name: string): string => path.join(flow().featureDir, 'controllers', `${name}.controller.ts`);

    it('does not repeat the feature in the route, and a create answers 201', () => {
        const spec = customAction('Project', 'createProject', { withInput: true, returns: 'one' }, 'create-project');
        const content = renderNestController(flow(), spec, 'Project', file('CreateProject'));
        expect(content).toContain("@Controller('create-project')");
        expect(content).toContain('@Post()\n  handle(@Body() body: CreateProjectDto): Promise<Project> {');
        expect(content).not.toContain("@Post('create-project')");
        expect(content).not.toContain('HttpCode');
    });

    it('routes a record action at :id', () => {
        const archive = contextFor('nest', 'archive-project');
        const spec = customAction('Project', 'archiveProject', { withInput: false, returns: 'one', method: 'patch', onRecord: true }, 'archive-project');
        const content = renderNestController(archive, spec, 'Project', path.join(archive.featureDir, 'controllers', 'ArchiveProject.controller.ts'));
        expect(content).toContain("@Controller('archive-project')");
        expect(content).toContain("@Patch(':id')");
    });
});

/** A feature inside an area folder `src/<area>` that has its own `<area>.module.ts`. */
function inArea(area: string, feature: string, withModule = true): RenderContext {
    mkdir(`src/${area}`);
    if (withModule) fs.writeFileSync(path.join(process.cwd(), 'src', area, `${area}.module.ts`), '');
    return contextFor('nest', feature, { featureRoot: `src/${area}` });
}

const fileIn = (context: RenderContext, name: string): string =>
    path.join(context.featureDir, 'controllers', `${name}.controller.ts`);

describe('renderNestController in an area that is the entity\'s resource', () => {
    it('routes a create flow at the area root, as the trial projects area does', () => {
        const flow = inArea('projects', 'create-project');
        const spec = customAction('Project', 'createProject', { withInput: true, returns: 'one', method: 'post' }, 'create-project');
        expect(renderNestController(flow, spec, 'Project', fileIn(flow, 'CreateProject'))).toBe(`import { Body, Controller, Post } from '@nestjs/common';
import type { Project } from '../types/Project.types';
import { CreateProjectDto } from '../dto/CreateProject.dto';
import { CreateProjectService } from '../services/CreateProject.service';

@Controller('projects')
export class CreateProjectController {
  constructor(private readonly service: CreateProjectService) {}

  @Post()
  handle(@Body() body: CreateProjectDto): Promise<Project> {
    return this.service.handle(body);
  }
}
`);
    });

    it('reads the input of a GET list from the query string, as the list-projects issue needed', () => {
        const flow = inArea('projects', 'list-projects');
        const spec = customAction('Project', 'listProject', { withInput: true, returns: 'list', method: 'get' }, 'list-projects');
        expect(renderNestController(flow, spec, 'Project', fileIn(flow, 'ListProject'))).toBe(`import { Controller, Get, Query } from '@nestjs/common';
import type { Project } from '../types/Project.types';
import { ListProjectDto } from '../dto/ListProject.dto';
import { ListProjectService } from '../services/ListProject.service';

@Controller('projects')
export class ListProjectController {
  constructor(private readonly service: ListProjectService) {}

  @Get()
  handle(@Query() query: ListProjectDto): Promise<Project[]> {
    return this.service.handle(query);
  }
}
`);
    });

    it('takes the id from the path and the input from the query on a GET on one record', () => {
        const flow = inArea('projects', 'project-history');
        const spec = customAction('Project', 'projectHistory', { withInput: true, returns: 'list', method: 'get', onRecord: true }, 'project-history');
        const content = renderNestController(flow, spec, 'Project', fileIn(flow, 'ProjectHistory'));
        expect(content).toContain("import { Controller, Get, Param, Query } from '@nestjs/common';");
        expect(content).toContain("  @Get(':id/history')\n  handle(@Param('id') id: string, @Query() query: ProjectHistoryDto): Promise<Project[]> {");
        expect(content).toContain('return this.service.handle(id, query);');
        expect(content).not.toContain('Body');
    });

    it('routes a custom action on one record at :id/<name minus the entity>', () => {
        const flow = inArea('projects', 'archive-project');
        const spec = customAction('Project', 'archiveProject', { withInput: false, returns: 'one', method: 'post', onRecord: true }, 'archive-project');
        const content = renderNestController(flow, spec, 'Project', fileIn(flow, 'ArchiveProject'));
        expect(content).toContain("import { Controller, HttpCode, Param, Post } from '@nestjs/common';");
        expect(content).toContain("@Controller('projects')");
        expect(content).toContain("  @Post(':id/archive')\n  @HttpCode(200)\n  handle(@Param('id') id: string): Promise<Project> {");
    });

    it.each([
        ['list-projects', 'listProjects', { withInput: false, returns: 'list' as const }, '@Get()'],
        ['show-project', 'showProject', { withInput: false, returns: 'one' as const, onRecord: true }, "@Get(':id')"],
        ['update-project', 'updateProject', { withInput: true, returns: 'one' as const, method: 'patch' as const, onRecord: true }, "@Patch(':id')"],
        ['delete-project', 'deleteProject', { withInput: false, returns: 'void' as const, method: 'delete' as const, onRecord: true }, "@Delete(':id')"],
        ['restore-project', 'restoreProject', { withInput: false, returns: 'one' as const, method: 'post' as const, onRecord: true }, "@Post(':id/restore')"],
        ['find-active-projects', 'findActiveProjects', { withInput: false, returns: 'list' as const }, "@Get('find-active')"],
    ])('routes the %s flow RESTfully on the area', (feature, action, options, decorator) => {
        const flow = inArea('projects', feature);
        const content = renderNestController(flow, customAction('Project', action, options, feature), 'Project', fileIn(flow, action));
        expect(content).toContain("@Controller('projects')");
        expect(content).toContain(`  ${decorator}\n`);
    });

    it('routes the standard five on the area, with Update as a PATCH', () => {
        const feature = inArea('projects', 'manage-projects');
        const decorators = ['List', 'Show', 'Create', 'Update', 'Delete'].map((action) => {
            const spec = standardAction(action as 'List', 'Project');
            const content = renderNestController(feature, spec, 'Project', fileIn(feature, spec.name));
            expect(content).toContain("@Controller('projects')");
            return content.split('\n').find((line) => /^ {2}@(Get|Post|Put|Patch|Delete)\(/.test(line))?.trim();
        });
        expect(decorators).toEqual(['@Get()', "@Get(':id')", '@Post()', "@Patch(':id')", "@Delete(':id')"]);
        const update = renderNestController(feature, standardAction('Update', 'Project'), 'Project', fileIn(feature, 'UpdateProject'));
        expect(update).toContain("import { Body, Controller, Param, Patch } from '@nestjs/common';");
        expect(update).not.toContain('HttpCode');
    });

    it('drops the slug of a single-resource area, so the profile update is PATCH /profile', () => {
        const flow = inArea('profile', 'update-profile');
        const spec = customAction('Profile', 'updateProfile', { withInput: true, returns: 'one', method: 'patch' }, 'update-profile');
        const content = renderNestController(flow, spec, 'Profile', fileIn(flow, 'UpdateProfile'));
        expect(content).toContain("@Controller('profile')");
        expect(content).toContain('  @Patch()\n');
    });

    it.each([
        ['categories', 'Category'],
        ['addresses', 'Address'],
        ['coffee-types', 'CoffeeType'],
        ['coffee-type', 'CoffeeType'],
    ])('treats the %s area as the %s resource', (area, entity) => {
        const flow = inArea(area, `archive-${area}`);
        const spec = customAction(entity, `archive${entity}`, { withInput: false, returns: 'one', method: 'patch', onRecord: true });
        const content = renderNestController(flow, spec, entity, fileIn(flow, `Archive${entity}`));
        expect(content).toContain(`@Controller('${area}')`);
        expect(content).toContain("@Patch(':id/archive')");
    });
});

describe('renderNestController in an area that groups flows', () => {
    it('puts the flow slug in the method decorator, as the trial login does', () => {
        const flow = inArea('auth', 'login');
        const spec = customAction('Session', 'login', { withInput: true, returns: 'one', method: 'post' }, 'login');
        expect(renderNestController(flow, spec, 'Session', fileIn(flow, 'Login'))).toBe(`import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { Session } from '../types/Session.types';
import { LoginDto } from '../dto/Login.dto';
import { LoginService } from '../services/Login.service';

@Controller('auth')
export class LoginController {
  constructor(private readonly service: LoginService) {}

  @Post('login')
  @HttpCode(200)
  handle(@Body() body: LoginDto): Promise<Session> {
    return this.service.handle(body);
  }
}
`);
    });

    it('routes an on-record flow at :id/<flow-slug>', () => {
        const flow = inArea('auth', 'revoke-session');
        const spec = customAction('Session', 'revokeSession', { withInput: false, returns: 'void', method: 'delete', onRecord: true }, 'revoke-session');
        const content = renderNestController(flow, spec, 'Session', fileIn(flow, 'RevokeSession'));
        expect(content).toContain("@Controller('auth')");
        expect(content).toContain("@Delete(':id/revoke-session')");
    });

    it('keeps an action of a resource feature under the feature slug', () => {
        const feature = inArea('auth', 'sessions');
        const list = renderNestController(feature, standardAction('List', 'Session'), 'Session', fileIn(feature, 'ListSession'));
        const show = renderNestController(feature, standardAction('Show', 'Session'), 'Session', fileIn(feature, 'ShowSession'));
        const revoke = customAction('Session', 'revokeSession', { withInput: false, returns: 'void', method: 'delete', onRecord: true }, 'sessions');
        const find = customAction('Session', 'findActiveSessions', { withInput: false, returns: 'list' }, 'sessions');
        expect(list).toContain("@Controller('auth')");
        expect(list).toContain("@Get('sessions')");
        expect(show).toContain("@Get('sessions/:id')");
        expect(renderNestController(feature, revoke, 'Session', fileIn(feature, 'RevokeSession'))).toContain("@Delete('sessions/:id/revoke-session')");
        expect(renderNestController(feature, find, 'Session', fileIn(feature, 'FindActiveSessions'))).toContain("@Get('sessions/find-active-sessions')");
    });
});

describe('renderNestController without an area module', () => {
    it('keeps routing a flow feature at its own root', () => {
        const flow = inArea('projects', 'create-project', false);
        const spec = customAction('Project', 'createProject', { withInput: true, returns: 'one', method: 'post' }, 'create-project');
        const content = renderNestController(flow, spec, 'Project', fileIn(flow, 'CreateProject'));
        expect(content).toContain("@Controller('create-project')");
        expect(content).toContain('  @Post()\n');
    });
});
