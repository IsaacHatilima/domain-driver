import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { detectStack, describeStack, resetStackCache } from '../detect';
import { createTempProject, writePackageJson, mkdir, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('detect');
});

afterEach(() => project.cleanup());

describe('detectStack rules', () => {
    it('detects nest before next and express', () => {
        writePackageJson({ '@nestjs/core': '1', next: '1', express: '1' });
        expect(detectStack().stack).toBe('nest');
    });

    it.each(['app/api', 'src/app/api', 'pages/api', 'src/pages/api'])(
        'detects next-fullstack when %s exists',
        (dir) => {
            writePackageJson({ next: '1', react: '1' });
            mkdir(dir);
            expect(detectStack().stack).toBe('next-fullstack');
        }
    );

    it('detects next-frontend when no api directory exists', () => {
        writePackageJson({ next: '1', react: '1' });
        expect(detectStack().stack).toBe('next-frontend');
    });

    it('detects react when react is present and next is absent', () => {
        writePackageJson({ react: '1' });
        expect(detectStack().stack).toBe('react');
    });

    it('detects node when nothing matches', () => {
        writePackageJson({ express: '1' });
        expect(detectStack().stack).toBe('node');
    });

    it('reads devDependencies too', () => {
        writePackageJson({}, { next: '1' });
        expect(detectStack().stack).toBe('next-frontend');
    });

    it('marks the source as detected', () => {
        writePackageJson({});
        expect(detectStack().source).toBe('detected');
    });

    it('detects tanstack-start from @tanstack/react-start', () => {
        writePackageJson({ '@tanstack/react-start': '1', react: '1' });
        expect(detectStack().stack).toBe('tanstack-start');
    });

    it('prefers tanstack-start over react and next', () => {
        writePackageJson({ '@tanstack/react-start': '1', react: '1', next: '1' });
        expect(detectStack().stack).toBe('tanstack-start');
    });
});

describe('secondary detection', () => {
    it.each([
        [{ express: '1' }, 'express'],
        [{ fastify: '1' }, 'fastify'],
        [{ hono: '1' }, 'hono'],
        [{ fastify: '1', express: '1' }, 'express'],
        [{}, null],
    ])('records the http framework for %o as %s', (deps, expected) => {
        writePackageJson(deps);
        expect(detectStack().httpFramework).toBe(expected);
    });

    it('leaves the http framework null on non-node stacks', () => {
        writePackageJson({ next: '1', express: '1' });
        expect(detectStack().httpFramework).toBeNull();
    });

    it('uses src/app for next when it exists', () => {
        writePackageJson({ next: '1' });
        mkdir('src/app');
        expect(detectStack().featureRoot).toBe('src/app');
    });

    it('uses app for next otherwise', () => {
        writePackageJson({ next: '1' });
        expect(detectStack().featureRoot).toBe('app');
    });

    it.each(['react', 'express'])('uses src/features for %s when src exists', (dep) => {
        writePackageJson({ [dep]: '1' });
        mkdir('src');
        expect(detectStack().featureRoot).toBe('src/features');
    });

    it('uses features for react without src', () => {
        writePackageJson({ react: '1' });
        expect(detectStack().featureRoot).toBe('features');
    });

    it('uses src for nest', () => {
        writePackageJson({ '@nestjs/core': '1' });
        expect(detectStack().featureRoot).toBe('src');
    });

    it('roots a tanstack-start feature at src/routes when it exists', () => {
        writePackageJson({ '@tanstack/react-start': '1' });
        mkdir('src/routes');
        expect(detectStack().featureRoot).toBe('src/routes');
    });

    it('falls back to routes when only that directory exists', () => {
        writePackageJson({ '@tanstack/react-start': '1' });
        mkdir('routes');
        expect(detectStack().featureRoot).toBe('routes');
    });

    it('defaults a bare tanstack-start project to src/routes', () => {
        writePackageJson({ '@tanstack/react-start': '1' });
        expect(detectStack().featureRoot).toBe('src/routes');
    });

    it('records nestjs-zod presence', () => {
        writePackageJson({ '@nestjs/core': '1', 'nestjs-zod': '1' });
        expect(detectStack().hasNestjsZod).toBe(true);
    });

    it('records nestjs-zod absence', () => {
        writePackageJson({ '@nestjs/core': '1' });
        expect(detectStack().hasNestjsZod).toBe(false);
    });
});

describe('override', () => {
    it('sets the stack and marks the source', () => {
        writePackageJson({ next: '1' });
        const result = detectStack('node');
        expect(result.stack).toBe('node');
        expect(result.source).toBe('override');
    });

    it('works without a package.json', () => {
        expect(detectStack('react').stack).toBe('react');
    });

    it('still detects the http framework from disk', () => {
        writePackageJson({ hono: '1' });
        expect(detectStack('node').httpFramework).toBe('hono');
    });

    it('rejects an unknown stack name', () => {
        writePackageJson({});
        expect(() => detectStack('remix')).toThrow(
            'Unknown stack "remix". Valid stacks: next-fullstack, next-frontend, react, node, nest, tanstack-start.'
        );
    });
});

describe('errors', () => {
    it('fails without a package.json', () => {
        expect(() => detectStack()).toThrow(
            `No package.json found in ${process.cwd()}. Run domain-driver from your project root, or pass --stack <name>.`
        );
    });

    it('fails on malformed package.json', () => {
        fs.writeFileSync('package.json', '{ not json');
        expect(() => detectStack()).toThrow(/^Could not parse package\.json: /);
    });
});

describe('cache', () => {
    it('returns the same frozen object on repeated calls', () => {
        writePackageJson({ react: '1' });
        const first = detectStack();
        expect(detectStack()).toBe(first);
        expect(Object.isFrozen(first)).toBe(true);
    });

    it('re-detects after reset', () => {
        writePackageJson({ react: '1' });
        detectStack();
        writePackageJson({ next: '1' });
        resetStackCache();
        expect(detectStack().stack).toBe('next-frontend');
    });
});

describe('describeStack', () => {
    it('describes a non-node stack', () => {
        writePackageJson({ next: '1' });
        expect(describeStack(detectStack())).toBe('Stack: next-frontend (detected)');
    });

    it('describes node with its framework', () => {
        writePackageJson({ fastify: '1' });
        expect(describeStack(detectStack())).toBe('Stack: node (detected), http: fastify');
    });

    it('describes node without a framework under override', () => {
        expect(describeStack(detectStack('node'))).toBe('Stack: node (override), http: none');
    });
});
