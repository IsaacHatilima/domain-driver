import { describe, it, expect, vi, afterEach } from 'vitest';
import { readPackageName, run, shouldRunPostinstall } from '../postinstall';
import { createTempProject, writePackageJson } from './helpers/project';

const consumer = (): string | null => 'my-app';

afterEach(() => vi.restoreAllMocks());

describe('shouldRunPostinstall', () => {
    it('skips on CI', () => {
        expect(shouldRunPostinstall({ CI: 'true', INIT_CWD: '/p' }, consumer)).toEqual({ run: false, reason: 'ci' });
        expect(shouldRunPostinstall({ CI: '1', INIT_CWD: '/p' }, consumer)).toEqual({ run: false, reason: 'ci' });
    });

    it.each(['', '0', 'false'])('treats CI=%s as not CI', (value) => {
        expect(shouldRunPostinstall({ CI: value, INIT_CWD: '/p' }, consumer)).toEqual({ run: true, root: '/p' });
    });

    it('skips global installs', () => {
        expect(shouldRunPostinstall({ npm_config_global: 'true', INIT_CWD: '/p' }, consumer)).toEqual({ run: false, reason: 'global' });
    });

    it('skips without INIT_CWD', () => {
        expect(shouldRunPostinstall({}, consumer)).toEqual({ run: false, reason: 'no-init-cwd' });
    });

    it('skips when the consumer has no package.json', () => {
        expect(shouldRunPostinstall({ INIT_CWD: '/p' }, () => null)).toEqual({ run: false, reason: 'no-consumer-package' });
    });

    it('skips when domain-driver installs itself', () => {
        expect(shouldRunPostinstall({ INIT_CWD: '/p' }, () => 'domain-driver')).toEqual({ run: false, reason: 'self-install' });
    });

    it('runs for a local consumer install', () => {
        expect(shouldRunPostinstall({ INIT_CWD: '/p' }, consumer)).toEqual({ run: true, root: '/p' });
    });
});

describe('readPackageName', () => {
    it('reads the name, returns an empty string when unnamed, null when missing', () => {
        const project = createTempProject('postinstall');
        try {
            expect(readPackageName(process.cwd())).toBeNull();
            writePackageJson({});
            expect(readPackageName(process.cwd())).toBe('fixture');
        } finally {
            project.cleanup();
        }
    });
});

describe('run', () => {
    it('calls init with the consumer root and prints one line per file', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const init = vi.fn(() => [{ file: 'AGENTS.md', status: 'created' as const }]);
        run(init, { INIT_CWD: '/consumer' }, () => 'my-app');
        expect(init).toHaveBeenCalledWith('/consumer');
        expect(log).toHaveBeenCalledWith('domain-driver: AGENTS.md created');
    });

    it('does nothing when skipped', () => {
        const init = vi.fn(() => []);
        run(init, { CI: '1', INIT_CWD: '/consumer' }, () => 'my-app');
        expect(init).not.toHaveBeenCalled();
    });

    it('never throws', () => {
        const init = vi.fn(() => {
            throw new Error('disk full');
        });
        expect(() => run(init, { INIT_CWD: '/consumer' }, () => 'my-app')).not.toThrow();
    });
});
