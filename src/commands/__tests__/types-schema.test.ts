import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    it('writes the types file into the feature', () => {
        writePackageJson({ next: '1' });
        mkdir('app/cat');
        makeTypes('cat', 'Cat');
        expect(readProjectFile('app/cat/types/Cat.types.ts')).toContain('export interface Cat');
    });

    it('skips an existing file with a warning', () => {
        writePackageJson({ next: '1' });
        mkdir('app/cat');
        makeTypes('cat', 'Cat');
        makeTypes('cat', 'Cat');
        expect(console.warn).toHaveBeenCalledWith('⚠️  Skipping "Cat.types.ts" — already exists');
    });

    it('throws when the feature does not exist', () => {
        writePackageJson({ next: '1' });
        expect(() => makeTypes('cat', 'Cat')).toThrow(
            'Feature "cat" does not exist. Run: domain-driver make:feature cat'
        );
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
    it('writes Create and Update schemas and no DTOs on react', () => {
        writePackageJson({ react: '1' });
        mkdir('src/features/cat');
        makeSchema('cat', 'Cat');
        expect(readProjectFile('src/features/cat/schemas/CreateCat.schema.ts')).toContain('CreateCatSchema');
        expect(readProjectFile('src/features/cat/schemas/UpdateCat.schema.ts')).not.toContain('id: z.string()');
        expect(projectFileExists('src/features/cat/dto')).toBe(false);
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
