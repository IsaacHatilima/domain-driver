import * as fs from 'fs';
import * as path from 'path';
import { resolveImport } from '../utils/imports';
import { ModuleProperty, registerInModule } from './register';
import { loadTypeScript } from './typescript';

export interface Entry {
    readonly identifier: string;
    /** Absolute path of the file that defines the identifier, used to build the import. */
    readonly definedIn: string;
    readonly property: ModuleProperty;
    readonly before?: string;
}

/**
 * Edits one module file in place, or explains what to add by hand and changes nothing.
 * A bail is never a failure: the generated files exist either way, so the caller succeeds.
 */
export function applyRegistrations(moduleFile: string, entries: readonly Entry[], enabled: boolean): void {
    if (entries.length === 0) return;
    if (!enabled) return explain(moduleFile, entries, 'automatic registration is off');

    const ts = loadTypeScript(process.cwd());
    if (ts === null) return explain(moduleFile, entries, 'typescript could not be resolved from this project');

    let source = fs.readFileSync(moduleFile, 'utf-8');
    const added: string[] = [];

    for (const entry of entries) {
        const result = registerInModule(ts, source, {
            identifier: entry.identifier,
            importPath: resolveImport(moduleFile, entry.definedIn),
            property: entry.property,
            before: entry.before,
        });
        if (result.status === 'bailed') return explain(moduleFile, entries, result.reason);
        if (result.status === 'already-registered') continue;
        source = result.source;
        added.push(entry.identifier);
    }

    if (added.length === 0) return;
    fs.writeFileSync(moduleFile, source);
    console.log(`✅ Registered ${added.join(', ')} in ${relative(moduleFile)}`);
}

function explain(moduleFile: string, entries: readonly Entry[], reason: string): void {
    console.log(`ℹ️  Did not edit ${relative(moduleFile)} (${reason}). Add by hand:`);
    for (const entry of entries) {
        console.log(`     import { ${entry.identifier} } from '${resolveImport(moduleFile, entry.definedIn)}';`);
    }
    const byProperty = new Map<ModuleProperty, string[]>();
    for (const entry of entries) {
        byProperty.set(entry.property, [...(byProperty.get(entry.property) ?? []), entry.identifier]);
    }
    for (const [property, names] of byProperty) {
        console.log(`     ${property}: [ ..., ${names.join(', ')} ]`);
    }
}

function relative(target: string): string {
    return path.relative(process.cwd(), target) || target;
}
