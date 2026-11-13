import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { detectAlias, resetAliasCache } from '../alias';
import { createTempProject, writeTsconfig, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

/** The tsconfig.json create-next-app 15 writes, verbatim but for the alias target. */
function createNextAppTsconfig(target: string): string {
    return `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["${target}"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`;
}

beforeEach(() => {
    project = createTempProject('alias');
});

afterEach(() => project.cleanup());

describe('detectAlias', () => {
    it('returns null without a tsconfig', () => {
        expect(detectAlias()).toBeNull();
    });

    it('maps @/* to the project root', () => {
        writeTsconfig({ '@/*': ['./*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: '.' });
    });

    it('maps @/* to src', () => {
        writeTsconfig({ '@/*': ['./src/*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src' });
    });

    it('maps a custom prefix to app', () => {
        writeTsconfig({ '~/*': ['./app/*'] });
        expect(detectAlias()).toEqual({ prefix: '~/', root: 'app' });
    });

    it('accepts targets without the leading ./', () => {
        writeTsconfig({ '@/*': ['src/*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src' });
    });

    it('accepts nested roots', () => {
        writeTsconfig({ '@/*': ['./src/app/*'] });
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src/app' });
    });

    it('takes the first wildcard entry', () => {
        writeTsconfig({ '@components/*': ['./components/*'], '@/*': ['./*'] });
        expect(detectAlias()).toEqual({ prefix: '@components/', root: 'components' });
    });

    it('ignores keys without a wildcard', () => {
        writeTsconfig({ '@config': ['./config.ts'] });
        expect(detectAlias()).toBeNull();
    });

    it('tolerates comments in tsconfig', () => {
        fs.writeFileSync(
            'tsconfig.json',
            '{\n  // comment\n  "compilerOptions": { /* block */ "paths": { "@/*": ["./*"] } }\n}'
        );
        expect(detectAlias()).toEqual({ prefix: '@/', root: '.' });
    });

    it('reads the tsconfig create-next-app writes with --src-dir', () => {
        fs.writeFileSync('tsconfig.json', createNextAppTsconfig('./src/*'));
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src' });
    });

    it('reads the tsconfig create-next-app writes without --src-dir', () => {
        fs.writeFileSync('tsconfig.json', createNextAppTsconfig('./*'));
        expect(detectAlias()).toEqual({ prefix: '@/', root: '.' });
    });

    it('keeps // inside a string, as in a $schema URL', () => {
        fs.writeFileSync(
            'tsconfig.json',
            '{\n  "$schema": "https://json.schemastore.org/tsconfig",\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } }\n}'
        );
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src' });
    });

    it('tolerates trailing commas, which tsc accepts', () => {
        fs.writeFileSync('tsconfig.json', '{\n  "compilerOptions": {\n    "paths": { "@/*": ["./src/*",], },\n  },\n}\n');
        expect(detectAlias()).toEqual({ prefix: '@/', root: 'src' });
    });

    it('returns null on malformed tsconfig', () => {
        fs.writeFileSync('tsconfig.json', '{ nope');
        expect(detectAlias()).toBeNull();
    });

    it('caches until reset', () => {
        expect(detectAlias()).toBeNull();
        writeTsconfig({ '@/*': ['./*'] });
        expect(detectAlias()).toBeNull();
        resetAliasCache();
        expect(detectAlias()).toEqual({ prefix: '@/', root: '.' });
    });
});
