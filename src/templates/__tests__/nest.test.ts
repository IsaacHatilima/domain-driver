import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderNestController } from '../controllers/nest';
import { renderDto } from '../nest/dto';
import { renderModule } from '../nest/module';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

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
        const content = renderNestController(ctx(), 'Create', 'CoffeeType', controllerFile('Create'));
        expect(content).toContain("import { Body, Controller, Post } from '@nestjs/common';");
        expect(content).toContain("import { CoffeeType } from '../types/CoffeeType.types';");
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
        const content = renderNestController(ctx(), 'Show', 'CoffeeType', controllerFile('Show'));
        expect(content).toContain("import { Controller, Get, Param } from '@nestjs/common';");
        expect(content).toContain("@Get(':id')");
        expect(content).toContain("handle(@Param('id') id: string): Promise<CoffeeType> {");
        expect(content).not.toContain('Dto');
    });

    it('renders list without params', () => {
        const content = renderNestController(ctx(), 'List', 'CoffeeType', controllerFile('List'));
        expect(content).toContain("import { Controller, Get } from '@nestjs/common';");
        expect(content).toContain('@Get()');
        expect(content).toContain('handle(): Promise<CoffeeType[]> {');
    });

    it('renders Put with param and body on update', () => {
        const content = renderNestController(ctx(), 'Update', 'CoffeeType', controllerFile('Update'));
        expect(content).toContain("import { Body, Controller, Param, Put } from '@nestjs/common';");
        expect(content).toContain("@Put(':id')");
        expect(content).toContain("handle(@Param('id') id: string, @Body() body: UpdateCoffeeTypeDto): Promise<CoffeeType> {");
        expect(content).toContain('return this.service.handle(id, body);');
    });

    it('renders Delete with a 204', () => {
        const content = renderNestController(ctx(), 'Delete', 'CoffeeType', controllerFile('Delete'));
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
        const content = renderDto(ctx(), 'Create', 'CoffeeType', fromFile);
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
