import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { makeTypes } from '../types';
import { makeSchema } from '../schema';
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
    project = createTempProject('types-schema');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('make:types', () => {
    it('writes the types file derived from the entity schema, and the schema with it', () => {
        writePackageJson({ next: '1' });
        mkdir('app/cat');
        makeTypes('cat', 'Cat');
        const types = readProjectFile('app/cat/types/Cat.types.ts');
        expect(types).toContain('export type Cat = z.infer<typeof CatSchema>;');
        expect(types).toContain("import type { CatSchema } from '../schemas/Cat.schema';");
        expect(types).not.toContain('interface');
        expect(readProjectFile('app/cat/schemas/Cat.schema.ts')).toContain('export const CatSchema = z.object({');
        expect(logged()).toContain(`✅ Schema for "Cat" created at ${path.join(process.cwd(), 'app/cat/schemas/Cat.schema.ts')}`);
    });

    it('keeps an existing entity schema and says nothing about it', () => {
        writePackageJson({ next: '1' });
        mkdir('app/cat/schemas');
        fs.writeFileSync(path.join(project.dir, 'app/cat/schemas/Cat.schema.ts'), 'export const CatSchema = custom;\n');
        makeTypes('cat', 'Cat');
        expect(readProjectFile('app/cat/schemas/Cat.schema.ts')).toBe('export const CatSchema = custom;\n');
        expect(console.warn).not.toHaveBeenCalled();
        expect(projectFileExists('app/cat/types/Cat.types.ts')).toBe(true);
    });

    it('skips an existing file with a warning', () => {
        writePackageJson({ next: '1' });
        mkdir('app/cat');
        makeTypes('cat', 'Cat');
        makeTypes('cat', 'Cat');
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "Cat.types.ts" — already exists');
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('creates the feature folder when it does not exist', () => {
        writePackageJson({ next: '1' });
        makeTypes('cat', 'Cat');
        expect(projectFileExists('app/cat/types/Cat.types.ts')).toBe(true);
        expect(projectFileExists('app/cat/schemas/Cat.schema.ts')).toBe(true);
        expect(logged()).toContain(`✅ Feature folder "cat" created at ${path.join(process.cwd(), 'app/cat')}`);
    });

    it('rejects an invalid feature name', () => {
        writePackageJson({ next: '1' });
        expect(() => makeTypes('Cat', 'Cat')).toThrow(
            'Feature name "Cat" must be kebab-case, for example coffee-type.'
        );
    });

    it('uses the stack feature root', () => {
        writePackageJson({ '@nestjs/core': '1' });
        mkdir('src/cat');
        makeTypes('cat', 'Cat');
        expect(projectFileExists('src/cat/types/Cat.types.ts')).toBe(true);
    });
});

describe('make:schema', () => {
    it('writes the entity, Create and Update schemas and no DTOs on react', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/cat');
        makeSchema('cat', 'Cat');
        expect(readProjectFile('src/features/cat/schemas/Cat.schema.ts')).toContain('export const CatSchema = z.object({');
        expect(readProjectFile('src/features/cat/schemas/CreateCat.schema.ts')).toContain('CreateCatSchema');
        expect(readProjectFile('src/features/cat/schemas/UpdateCat.schema.ts')).not.toContain('id: z.string()');
        expect(projectFileExists('src/features/cat/dto')).toBe(false);
    });

    it('does not warn about the entity schema that make:types already wrote', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/cat');
        makeTypes('cat', 'Cat');
        makeSchema('cat', 'Cat');
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('writes no DTO for the entity schema on nest: it describes responses, not input', () => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' });
        mkdir('src/cat');
        makeSchema('cat', 'Cat');
        expect(projectFileExists('src/cat/schemas/Cat.schema.ts')).toBe(true);
        expect(projectFileExists('src/cat/dto/Cat.dto.ts')).toBe(false);
        expect(projectFileExists('src/cat/dto/CreateCat.dto.ts')).toBe(true);
    });

    it('writes DTOs on nest and hints once when nestjs-zod is missing', () => {
        writePackageJson({ '@nestjs/core': '1' });
        mkdir('src/cat');
        makeSchema('cat', 'Cat');
        makeSchema('cat', 'Cat');
        expect(readProjectFile('src/cat/dto/CreateCat.dto.ts')).toContain('createZodDto(CreateCatSchema)');
        expect(readProjectFile('src/cat/dto/UpdateCat.dto.ts')).toContain('class UpdateCatDto');
        const logged = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
        expect(logged.filter((line) => line.includes('nestjs-zod is not installed'))).toHaveLength(1);
        expect(logged.some((line) => line.includes('{ provide: APP_PIPE, useClass: ZodValidationPipe }'))).toBe(true);
    });

    it('does not hint when nestjs-zod is installed', () => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' });
        mkdir('src/cat');
        makeSchema('cat', 'Cat');
        const logged = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
        expect(logged.some((line) => line.includes('nestjs-zod'))).toBe(false);
    });

    it('does not print the created lines again on a re-run', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/cat');
        makeSchema('cat', 'Cat');
        vi.mocked(console.log).mockClear();
        makeSchema('cat', 'Cat');
        const logged = vi.mocked(console.log).mock.calls.map(([message]) => String(message));
        expect(logged.some((line) => line.includes('✅'))).toBe(false);
    });
});
