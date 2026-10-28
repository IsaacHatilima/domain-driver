import * as fs from 'fs';
import * as path from 'path';
import { Library } from './library';
import { SectionStatus } from './markers';

/** Plan every retirement before writing so a conflicting old copy stays intact. */
export function planSharedSkills(root: string, library: Library): () => readonly SectionStatus[] {
    const removals = new Set<string>();
    const directories = new Set<string>();
    const canonical = new Map(library.files.map(file => [file.file, file.content]));
    for (const file of ['AGENTS.md', 'CLAUDE.md', ...canonical.keys()]) assertPlainPath(root, file);

    const inspectCopy = (relative: string, target: string): void => {
        assertPlainPath(root, relative);
        const absolute = path.join(root, relative);
        const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
        if (!stat) return;
        if (stat.isDirectory()) {
            directories.add(absolute);
            for (const entry of fs.readdirSync(absolute)) inspectCopy(`${relative}/${entry}`, `${target}/${entry}`);
            return;
        }
        const desired = canonical.get(target);
        const previous = fs.lstatSync(path.join(root, target), { throwIfNoEntry: false })?.isFile() ? fs.readFileSync(path.join(root, target), 'utf8') : undefined;
        const contents = stat.isFile() ? fs.readFileSync(absolute, 'utf8') : undefined;
        if (contents === undefined || (contents !== desired && contents !== previous)) {
            throw new Error(`Cannot consolidate ${relative}: locally modified or unowned file preserved. Reconcile it with ${target}, then run init again.`);
        }
        removals.add(absolute);
    };

    for (const link of library.links) {
        assertPlainPath(root, path.posix.dirname(link.file));
        const absolute = path.join(root, link.file);
        if (fs.lstatSync(absolute, { throwIfNoEntry: false })?.isSymbolicLink()) {
            if (fs.readlinkSync(absolute) !== linkTarget(link.file, link.target)) {
                throw new Error(`Refusing symlink in init destination: ${link.file}`);
            }
        } else {
            inspectCopy(link.file, link.target);
        }
        // The previous delivery also wrote an unused full .ai copy in JS projects.
        inspectCopy(link.file.replace(/^\.claude\//, '.ai/'), link.target);
    }

    return () => {
        const statuses: SectionStatus[] = [];
        for (const file of removals) fs.unlinkSync(file);
        for (const directory of [...directories].sort((a, b) => b.length - a.length)) fs.rmdirSync(directory);
        if (removals.size > 0) statuses.push('updated');
        for (const link of library.links) {
            const absolute = path.join(root, link.file);
            if (fs.lstatSync(absolute, { throwIfNoEntry: false })?.isSymbolicLink()) {
                statuses.push('unchanged');
                continue;
            }
            fs.mkdirSync(path.dirname(absolute), { recursive: true });
            fs.symlinkSync(linkTarget(link.file, link.target), absolute, link.file.endsWith('.md') ? 'file' : 'dir');
            statuses.push('created');
        }
        for (const suffix of ['.ai/skills', '.ai']) {
            const absolute = path.join(root, suffix);
            if (fs.lstatSync(absolute, { throwIfNoEntry: false })?.isDirectory() && fs.readdirSync(absolute).length === 0) fs.rmdirSync(absolute);
        }
        return statuses;
    };
}

function linkTarget(file: string, target: string): string {
    return path.relative(path.dirname(file), target);
}

function assertPlainPath(root: string, relative: string): void {
    let absolute = root;
    for (const part of relative.split('/')) {
        absolute = path.join(absolute, part);
        if (fs.lstatSync(absolute, { throwIfNoEntry: false })?.isSymbolicLink()) {
            throw new Error(`Refusing symlink in init destination: ${relative}`);
        }
    }
}
