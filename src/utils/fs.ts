import * as fs from 'fs';
import * as path from 'path';
import { recordWrite } from '../format/written';

/** The empty file `make:feature` leaves in each layer folder so git tracks it before it has content. */
export const PLACEHOLDER = '.gitkeep';

/**
 * Writes a file, then removes the folder's placeholder: once the folder holds a real file the
 * placeholder has no job left, and leaving it behind gets it committed next to the code.
 */
export function writeFileSafe(filePath: string, content: string): void {
    try {
        fs.writeFileSync(filePath, content);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to write ${filePath}: ${message}`);
    }
    if (path.basename(filePath) === PLACEHOLDER) return;
    recordWrite(filePath);
    removePlaceholder(path.dirname(filePath));
}

/**
 * Replaces a file's content through a sibling temp file and a rename. `writeFileSync` truncates
 * before writing, so a failure partway through would leave the file cut in half; a same-directory
 * rename is atomic, so the file holds either its old content or its new. Throws on failure,
 * with the old content in place.
 */
export function replaceFile(filePath: string, content: string): void {
    const temporary = `${filePath}.domain-driver.tmp`;
    try {
        fs.writeFileSync(temporary, content);
        fs.renameSync(temporary, filePath);
    } catch (error: unknown) {
        try {
            fs.rmSync(temporary, { force: true });
        } catch {
            // The temp file is already gone, or unremovable for the same reason the write failed.
        }
        throw error;
    }
}

function removePlaceholder(dir: string): void {
    const placeholder = path.join(dir, PLACEHOLDER);
    try {
        fs.rmSync(placeholder, { force: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Wrote into ${dir} but could not remove its ${PLACEHOLDER}: ${message}`);
    }
}

export function mkdirSafe(dirPath: string): void {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to create directory ${dirPath}: ${message}`);
    }
}

export function fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
}

export function isDirectory(target: string): boolean {
    return fs.existsSync(target) && fs.statSync(target).isDirectory();
}
