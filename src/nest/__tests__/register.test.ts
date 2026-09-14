import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import { registerInModule } from '../register';

const REALISTIC = `import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './features/auth/auth.module';

@Module({
  imports: [
    // Global infrastructure first: each of these registers itself with @Global().
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      useFactory: (env: Env) => ({
        throttlers: [{ ttl: env.THROTTLE_TTL_MS, limit: env.THROTTLE_LIMIT }],
      }),
    }),
    AuthModule,
  ],
  providers: [],
})
export class AppModule {}
`;

function register(source: string, identifier = 'AssetsModule'): ReturnType<typeof registerInModule> {
    return registerInModule(ts, source, {
        identifier,
        importPath: './features/assets/assets.module',
        property: 'imports',
    });
}

function edited(source: string, identifier?: string): string {
    const result = register(source, identifier);
    if (result.status !== 'edited') throw new Error(`expected an edit, got ${result.status}`);
    return result.source;
}

describe('registerInModule ordering', () => {
    const CONTROLLERS = `import { Module } from '@nestjs/common';

@Module({
  controllers: [
    ListCatController,
    ShowCatController,
  ],
})
export class CatModule {}
`;

    it('inserts before a named element so a custom route outranks /:id', () => {
        const result = registerInModule(ts, CONTROLLERS, {
            identifier: 'FindActiveCatsController',
            importPath: './controllers/FindActiveCats.controller',
            property: 'controllers',
            before: 'ShowCatController',
        });
        if (result.status !== 'edited') throw new Error(`expected an edit, got ${result.status}`);
        expect(result.source).toContain(
            '    ListCatController,\n    FindActiveCatsController,\n    ShowCatController,'
        );
    });

    it('appends when the named element is absent', () => {
        const source = `import { Module } from '@nestjs/common';

@Module({
  controllers: [ListCatController],
})
export class CatModule {}
`;
        const result = registerInModule(ts, source, {
            identifier: 'FindActiveCatsController',
            importPath: './controllers/FindActiveCats.controller',
            property: 'controllers',
            before: 'ShowCatController',
        });
        if (result.status !== 'edited') throw new Error(`expected an edit, got ${result.status}`);
        expect(result.source).toContain('controllers: [ListCatController, FindActiveCatsController]');
    });
});

describe('registerInModule', () => {
    it('appends after the last element without entering a nested array', () => {
        const out = edited(REALISTIC);
        expect(out).toContain('    AuthModule,\n    AssetsModule,\n  ],');
        expect(out).toContain('throttlers: [{ ttl: env.THROTTLE_TTL_MS, limit: env.THROTTLE_LIMIT }],');
    });

    it('adds the import after the last existing import', () => {
        const out = edited(REALISTIC);
        expect(out).toContain(
            "import { AuthModule } from './features/auth/auth.module';\n" +
                "import { AssetsModule } from './features/assets/assets.module';"
        );
    });

    it('keeps every comment and every untouched line byte-for-byte', () => {
        const out = edited(REALISTIC);
        expect(out).toContain('// Global infrastructure first: each of these registers itself with @Global().');
        for (const line of REALISTIC.split('\n')) {
            if (line.trim() !== '') expect(out).toContain(line);
        }
    });

    it('expands an empty array onto its own lines, matching the generated module style', () => {
        const source = `import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
`;
        expect(edited(source)).toContain('  imports: [\n    AssetsModule,\n  ],');
    });

    it('does not add a second import for an identifier already bound', () => {
        const source = `import { Module } from '@nestjs/common';
import { AssetsModule } from './features/assets/assets.module';

@Module({
  imports: [AuthModule],
})
export class AppModule {}
`;
        const out = edited(source);
        expect(out.match(/import \{ AssetsModule \}/g)).toHaveLength(1);
        expect(out).toContain('imports: [AuthModule, AssetsModule]');
    });

    it('bails when the file did not parse to begin with', () => {
        const result = register('@Module({ imports: [ } export class Broken\n');
        expect(result.status).toBe('bailed');
        if (result.status === 'bailed') expect(result.reason).toMatch(/does not parse/);
    });

    it('keeps CRLF line endings out of inserted lines when the file uses them', () => {
        const source = REALISTIC.replace(/\n/g, '\r\n');
        const out = edited(source);
        expect(out).not.toMatch(/[^\r]\n/);
    });

    it('reports an identifier that is already registered', () => {
        expect(register(REALISTIC, 'AuthModule').status).toBe('already-registered');
    });

    it('does not treat an identifier inside a comment as registered', () => {
        const source = `import { Module } from '@nestjs/common';

@Module({
  // AssetsModule goes here one day
  imports: [AuthModule],
})
export class AppModule {}
`;
        expect(edited(source)).toContain('imports: [AuthModule, AssetsModule]');
    });

    it('bails when there is no Module decorator', () => {
        const result = register(`export class AppModule {}\n`);
        expect(result.status).toBe('bailed');
        if (result.status === 'bailed') expect(result.reason).toMatch(/@Module/);
    });

    it('bails when the property is missing', () => {
        const source = `import { Module } from '@nestjs/common';

@Module({
  providers: [],
})
export class AppModule {}
`;
        const result = register(source);
        expect(result.status).toBe('bailed');
        if (result.status === 'bailed') expect(result.reason).toMatch(/imports/);
    });

    it('bails when the property is not an array', () => {
        const source = `import { Module } from '@nestjs/common';

@Module({
  imports: someSpread,
})
export class AppModule {}
`;
        expect(register(source).status).toBe('bailed');
    });

    it('produces source that still parses', () => {
        const out = edited(REALISTIC);
        const diagnostics = ts.transpileModule(out, {
            reportDiagnostics: true,
            compilerOptions: { target: ts.ScriptTarget.Latest },
        }).diagnostics;
        expect(diagnostics ?? []).toHaveLength(0);
    });
});
