import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { resolveImport } from '../imports';
import { createTempProject, writePackageJson, writeTsconfig, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

const abs = (relative: string): string => path.join(process.cwd(), relative);

beforeEach(() => {
    project = createTempProject('imports');
});

afterEach(() => project.cleanup());

describe('resolveImport without alias', () => {
    it('resolves a sibling folder', () => {
        expect(resolveImport(abs('app/cat/hooks/useCat.ts'), abs('app/cat/types/Cat.types.ts'))).toBe(
            '../types/Cat.types'
        );
    });

    it('resolves the same folder with ./', () => {
        expect(
            resolveImport(abs('app/cat/page.tsx'), abs('app/cat/containers/CatContainer.tsx'))
        ).toBe('./containers/CatContainer');
    });

    it('resolves two levels deep', () => {
        expect(
            resolveImport(
                abs('app/cat/client/repositories/CreateCat.repository.ts'),
                abs('app/cat/types/Cat.types.ts')
            )
        ).toBe('../../types/Cat.types');
    });

    it('resolves from a Next api route into the feature', () => {
        expect(
            resolveImport(
                abs('app/api/cat/[id]/route.ts'),
                abs('app/cat/server/services/ShowCat.service.ts')
            )
        ).toBe('../../../cat/server/services/ShowCat.service');
    });

    it('strips .tsx', () => {
        expect(resolveImport(abs('a/x.ts'), abs('a/Y.tsx'))).toBe('./Y');
    });
});

describe('resolveImport with alias', () => {
    it('uses the alias when the root is the project', () => {
        writeTsconfig({ '@/*': ['./*'] });
        expect(resolveImport(abs('app/cat/hooks/useCat.ts'), abs('app/cat/types/Cat.types.ts'))).toBe(
            '@/app/cat/types/Cat.types'
        );
    });

    it('drops the aliased root segment', () => {
        writeTsconfig({ '@/*': ['./app/*'] });
        expect(resolveImport(abs('app/cat/hooks/useCat.ts'), abs('app/cat/types/Cat.types.ts'))).toBe(
            '@/cat/types/Cat.types'
        );
    });

    it('handles src roots', () => {
        writeTsconfig({ '@/*': ['./src/*'] });
        expect(
            resolveImport(abs('src/app/cat/hooks/useCat.ts'), abs('src/app/cat/types/Cat.types.ts'))
        ).toBe('@/app/cat/types/Cat.types');
    });

    it('falls back to relative when the target is outside the alias root', () => {
        writeTsconfig({ '@components/*': ['./components/*'] });
        expect(resolveImport(abs('app/cat/hooks/useCat.ts'), abs('app/cat/types/Cat.types.ts'))).toBe(
            '../types/Cat.types'
        );
    });
});

describe('Node ESM imports', () => {
    function configure(moduleResolution: string, extra: Record<string, unknown> = {}): void {
        fs.mkdirSync('node_modules', { recursive: true });
        fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), 'node_modules/typescript', 'dir');
        writePackageJson({}, {}, { type: 'module' });
        fs.writeFileSync('tsconfig.json', JSON.stringify({ compilerOptions: { module: moduleResolution === 'bundler' ? 'esnext' : moduleResolution, moduleResolution, ...extra } }));
    }

    it('uses runtime .js extensions in the Nest NodeNext ESM starter', () => {
        configure('nodenext');
        expect(resolveImport(abs('src/app.module.ts'), abs('src/cat/cat.module.ts'))).toBe('./cat/cat.module.js');
        expect(resolveImport(abs('src/cat/dto/CreateCat.dto.ts'), abs('src/cat/schemas/CreateCat.schema'))).toBe('../schemas/CreateCat.schema.js');
    });

    it('keeps extensionless imports for CommonJS and bundler projects', () => {
        configure('nodenext');
        writePackageJson({});
        expect(resolveImport(abs('src/app.module.ts'), abs('src/cat/cat.module.ts'))).toBe('./cat/cat.module');
    });

    it('keeps bundler aliases and resolves inherited NodeNext compiler settings', () => {
        configure('bundler', { paths: { '@/*': ['./src/*'] } });
        expect(resolveImport(abs('src/a.ts'), abs('src/b.ts'))).toBe('@/b');
        fs.writeFileSync('tsconfig.base.json', JSON.stringify({ compilerOptions: { module: 'nodenext', moduleResolution: 'nodenext' } }));
        fs.writeFileSync('tsconfig.json', JSON.stringify({ extends: './tsconfig.base.json' }));
        expect(resolveImport(abs('src/a.ts'), abs('src/b.ts'))).toBe('./b.js');
    });
});
