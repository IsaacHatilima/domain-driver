import * as fs from 'fs';
import * as path from 'path';

export const LIBRARY_ROOT: string = path.resolve(__dirname, '..', '..', 'agent-library');

export interface LibraryFile {
    readonly file: string;
    readonly content: string;
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
export function readLibraryFiles(root: string = LIBRARY_ROOT): readonly LibraryFile[] {
    const manifest: unknown = JSON.parse(fs.readFileSync(sourcePath(root, 'catalog.json'), 'utf8'));
    if (!record(manifest) || manifest.schema !== 1 || !Array.isArray(manifest.items) || manifest.items.length === 0) {
        throw new Error('Invalid agent-library catalog: expected schema 1 and nonempty items');
    }
    const files = new Map<string, string>();
    const names = new Set<string>();
    for (const item of manifest.items) {
        if (!record(item) || typeof item.name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.name) || !record(item.files) || Object.keys(item.files).length === 0) {
            throw new Error('Invalid agent-library item');
        }
        if (names.has(item.name)) throw new Error(`Duplicate library item: ${item.name}`);
        names.add(item.name);
        for (const [file, source] of Object.entries(item.files)) {
            destination(file);
            if (typeof source !== 'string') throw new Error(`Invalid library source for ${file}`);
            if (files.has(file)) throw new Error(`Duplicate library destination: ${file}`);
            files.set(file, fs.readFileSync(sourcePath(root, source), 'utf8'));
        }
    }
    return Object.freeze([...files].map(([file, content]) => Object.freeze({ file, content })));
}
