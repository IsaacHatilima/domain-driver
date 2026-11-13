import * as path from 'path';

/**
 * The files this run wrote or changed, absolute and in the order first written. Formatting reads
 * them once the command is done, so Prettier is only ever handed files the command produced or
 * edited, never the project's other files.
 */
let written: readonly string[] = [];

export function recordWrite(filePath: string): void {
    const absolute = path.resolve(filePath);
    if (!written.includes(absolute)) written = [...written, absolute];
}

/** The files written since the last call; the next run starts from none. */
export function takeWrittenFiles(): readonly string[] {
    const files = written;
    written = [];
    return files;
}
