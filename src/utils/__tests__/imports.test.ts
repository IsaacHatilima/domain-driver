import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { resolveImport } from '../imports';
import { createTempProject, writeTsconfig, TempProject } from '../../__tests__/helpers/project';

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
