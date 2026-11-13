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
    /** Insert ahead of this identifier when present. Nest matches routes in declaration order. */
    readonly before?: string;
}

/**
 * Edits one module file in place, or explains what to add by hand and changes nothing.
 * A bail is never a failure: the generated files exist either way, so the caller succeeds.
 */
export function applyRegistrations(moduleFile: string, entries: readonly Entry[], enabled: boolean): void {
    if (entries.length === 0) return;
    if (!enabled) return explain(moduleFile, entries, 'automatic registration is off');
    if (!fs.existsSync(moduleFile)) return explain(moduleFile, entries, 'the module file does not exist');

    const ts = loadTypeScript(process.cwd());
    if (ts === null) return explain(moduleFile, entries, 'typescript could not be resolved from this project');

    let source: string;
    try {
        source = fs.readFileSync(moduleFile, 'utf-8');
    } catch {
        return explain(moduleFile, entries, 'the file could not be read');
    }

    const added: string[] = [];
    const outstanding: Entry[] = [];

    for (const entry of entries) {
        const result = registerInModule(ts, source, {
            identifier: entry.identifier,
            importPath: resolveImport(moduleFile, entry.definedIn),
            property: entry.property,
            before: entry.before,
        });
        if (result.status === 'bailed') {
            return explain(moduleFile, [...outstanding, ...entries.slice(entries.indexOf(entry))], result.reason);
        }
        if (result.status === 'already-registered') continue;
        source = result.source;
        added.push(entry.identifier);
    }

    if (added.length === 0) return;
    if (!write(moduleFile, source)) return explain(moduleFile, entries, 'the file could not be written');
    console.log(`✅ Registered ${added.join(', ')} in ${relative(moduleFile)}`);
}

/**
 * Writes through a sibling temp file and renames. `writeFileSync` truncates before writing, so a
 * failure partway through would leave the file that boots the application cut in half.
 * A same-directory rename is atomic, which makes that outcome unreachable.
 */
function write(moduleFile: string, source: string): boolean {
    const temporary = `${moduleFile}.domain-driver.tmp`;
    try {
        fs.writeFileSync(temporary, source);
        fs.renameSync(temporary, moduleFile);
        return true;
    } catch {
        try {
            fs.rmSync(temporary, { force: true });
        } catch {
            // The temp file is already gone, or unremovable for the same reason the write failed.
        }
        return false;
    }
}

function explain(moduleFile: string, entries: readonly Entry[], reason: string): void {
    if (entries.length === 0) return;
    const source = readModule(moduleFile);
    console.log(`ℹ️  Did not edit ${relative(moduleFile)} (${reason}). Add by hand:`);
    for (const entry of entries) {
        console.log(`     import { ${entry.identifier} } from '${resolveImport(moduleFile, entry.definedIn)}';`);
    }

    const byProperty = new Map<ModuleProperty, Entry[]>();
    for (const entry of entries) {
        byProperty.set(entry.property, [...(byProperty.get(entry.property) ?? []), entry]);
    }
    for (const [property, group] of byProperty) {
        console.log(`     ${property}: [ ..., ${group.map((entry) => placement(entry, source)).join(', ')} ]`);
    }
}

function readModule(moduleFile: string): string | null {
    try {
        return fs.readFileSync(moduleFile, 'utf-8');
    } catch {
        return null;
    }
}

/**
 * An ordered entry has to say where it goes, or the pasted line reproduces the bug it prevents.
 * It only says so relative to a class the module has: a feature that is one action has no
 * Show<Entity>Controller, and naming one sends the reader looking for a class that is not there.
 */
function placement(entry: Entry, source: string | null): string {
    if (entry.before === undefined || source === null) return entry.identifier;
    const present = new RegExp(`\\b${entry.before}\\b`).test(source);
    return present ? `${entry.identifier}, ${entry.before}` : entry.identifier;
}

function relative(target: string): string {
    return path.relative(process.cwd(), target) || target;
}
