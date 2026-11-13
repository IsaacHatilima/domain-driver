import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createTempProject, readProjectFile, TempProject } from '../../__tests__/helpers/project';
import { installFakePrettier } from '../../__tests__/helpers/prettier';
import { writeFileSafe } from '../../utils/fs';
import { formatWrittenFiles } from '../format-files';
import { FileInfo, loadPrettier, PrettierApi } from '../prettier';
import { recordWrite, takeWrittenFiles } from '../written';

let project: TempProject;

const warnings = (): string[] => vi.mocked(console.warn).mock.calls.map(([message]) => String(message));

/** A Prettier whose config always exists and whose format upper-cases the source. */
function stubPrettier(info: FileInfo = { ignored: false, inferredParser: 'typescript' }): PrettierApi {
    return {
        resolveConfigFile: async () => '/project/.prettierrc',
        resolveConfig: async () => ({}),
        getFileInfo: async () => info,
        format: (source) => source.toUpperCase(),
    };
}

beforeEach(() => {
    project = createTempProject('format-files');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    project.cleanup();
    vi.restoreAllMocks();
});

describe('the written-files log', () => {
    it('keeps each file once, absolute, in the order first written, and empties when taken', () => {
        const cwd = process.cwd();
        recordWrite('src/a.ts');
        recordWrite(path.join(cwd, 'src/b.ts'));
        recordWrite(path.join(cwd, 'src/a.ts'));

        expect(takeWrittenFiles()).toEqual([path.join(cwd, 'src/a.ts'), path.join(cwd, 'src/b.ts')]);
        expect(takeWrittenFiles()).toEqual([]);
    });

    it('records generated files but not the .gitkeep placeholder', () => {
        fs.mkdirSync('src');
        writeFileSafe('src/.gitkeep', '');
        writeFileSafe('src/a.ts', 'export {};\n');

        expect(takeWrittenFiles()).toEqual([path.join(process.cwd(), 'src/a.ts')]);
    });
});

describe('loadPrettier', () => {
    it('returns null when the project has no prettier', () => {
        expect(loadPrettier(project.dir)).toBeNull();
    });

    it('loads the prettier installed in the project', () => {
        installFakePrettier();
        const prettier = loadPrettier(project.dir);
        expect(typeof prettier?.format).toBe('function');
    });
});

describe('formatWrittenFiles', () => {
    function writeSource(relative: string, content: string): string {
        const file = path.join(project.dir, relative);
        fs.writeFileSync(file, content);
        return file;
    }

    it('does not load prettier when nothing was written', async () => {
        const load = vi.fn(() => stubPrettier());
        await formatWrittenFiles(project.dir, [], load);
        expect(load).not.toHaveBeenCalled();
    });

    it('formats with the loaded prettier and leaves no temp file behind', async () => {
        const file = writeSource('a.ts', 'export const a = 1;\n');
        await formatWrittenFiles(project.dir, [file], () => stubPrettier());
        expect(readProjectFile('a.ts')).toBe('EXPORT CONST A = 1;\n');
        expect(fs.readdirSync(project.dir)).toEqual(['a.ts']);
    });

    it('leaves a file Prettier has no parser for', async () => {
        const file = writeSource('a.ts', 'export const a = 1;\n');
        await formatWrittenFiles(project.dir, [file], () => stubPrettier({ ignored: false, inferredParser: null }));
        expect(readProjectFile('a.ts')).toBe('export const a = 1;\n');
    });

    it('warns for each file and keeps it when formatting throws, then formats the rest', async () => {
        const broken = writeSource('broken.ts', 'export const a = 1;\n');
        const fine = writeSource('fine.ts', 'export const b = 2;\n');
        const prettier: PrettierApi = {
            ...stubPrettier(),
            format: (source, options) => {
                if (options.filepath === broken) throw new Error('SyntaxError: Unexpected token (1:3)\n> 1 | ...');
                return source.toUpperCase();
            },
        };

        await formatWrittenFiles(project.dir, [broken, fine], () => prettier);

        expect(readProjectFile('broken.ts')).toBe('export const a = 1;\n');
        expect(readProjectFile('fine.ts')).toBe('EXPORT CONST B = 2;\n');
        expect(warnings()).toEqual([
            '⚠️  Did not format broken.ts (SyntaxError: Unexpected token (1:3)); kept it as generated',
        ]);
    });
});
