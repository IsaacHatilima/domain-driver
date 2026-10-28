import * as fs from 'fs';
import * as path from 'path';

export const LIBRARY_ROOT: string = path.resolve(__dirname, '..', '..', 'agent-library');
export const LIBRARY_SCHEMA = 2;

export interface LibraryFile {
    readonly file: string;
    readonly content: string;
}

export interface LibraryLink {
    readonly file: string;
    readonly target: string;
}

export interface Library {
    readonly files: readonly LibraryFile[];
    readonly links: readonly LibraryLink[];
}

function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sourcePath(root: string, relative: string): string {
    const parts = relative.split('/');
    if (path.isAbsolute(relative) || parts.some(part => part === '' || part === '.' || part === '..' || part.includes('\\'))) {
        throw new Error(`Unsafe library source: ${relative}`);
    }
    let absolute = root;
    for (const part of parts) {
        absolute = path.join(absolute, part);
        if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`Symlink in library source: ${relative}`);
    }
    return absolute;
}

function destination(file: string): void {
    const allowed = /^(?:\.(?:ai|agents|claude)\/skills\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*|\.(?:claude|codex)\/agents\/[A-Za-z0-9_-]+\.(?:md|toml))$/;
    if (!allowed.test(file) || file.split('/').some(part => part === '.' || part === '..')) {
        throw new Error(`Unsafe library destination: ${file}`);
    }
}

/** Read the generated delivery, without embedding skill instructions in the CLI. */
export function readLibrary(root: string = LIBRARY_ROOT): Library {
    const manifest: unknown = JSON.parse(fs.readFileSync(sourcePath(root, 'catalog.json'), 'utf8'));
    if (!record(manifest) || ![1, LIBRARY_SCHEMA].includes(manifest.schema as number) || !Array.isArray(manifest.items) || manifest.items.length === 0) {
        throw new Error('Invalid agent-library catalog: expected supported schema and nonempty items');
    }
    const files = new Map<string, string>();
    const names = new Set<string>();
    const links = new Map<string, string>();
    for (const item of manifest.items) {
        if (!record(item) || typeof item.name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.name) || !record(item.files) || Object.keys(item.files).length === 0) {
            throw new Error('Invalid agent-library item');
        }
        if (names.has(item.name)) throw new Error(`Duplicate library item: ${item.name}`);
        names.add(item.name);
        for (const [file, source] of Object.entries(item.files)) {
            destination(file);
            if (typeof source !== 'string') throw new Error(`Invalid library source for ${file}`);
            if (files.has(file) || links.has(file)) throw new Error(`Duplicate library destination: ${file}`);
            files.set(file, fs.readFileSync(sourcePath(root, source), 'utf8'));
        }
        if (item.links !== undefined) {
            if (!record(item.links)) throw new Error('Invalid library links');
            for (const [file, target] of Object.entries(item.links)) {
                const name = file.split('/')[2];
                if (!/^\.claude\/skills\/[a-z0-9.-]+$/.test(file) || typeof target !== 'string'
                    || target !== `.agents/skills/${name}` || ![item.name, 'catalog.md'].includes(name)
                    || !Object.keys(item.files).some(owned => owned === target || owned.startsWith(`${target}/`))) {
                    throw new Error(`Unsafe library link: ${file}`);
                }
                if (links.has(file) || files.has(file)) throw new Error(`Duplicate library destination: ${file}`);
                links.set(file, target);
            }
        }
    }
    return Object.freeze({
        files: Object.freeze([...files].map(([file, content]) => Object.freeze({ file, content }))),
        links: Object.freeze([...links].map(([file, target]) => Object.freeze({ file, target }))),
    });
}

export function readLibraryFiles(root: string = LIBRARY_ROOT): readonly LibraryFile[] {
    return readLibrary(root).files;
}
