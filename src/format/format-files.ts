import * as fs from 'fs';
import * as path from 'path';
import { replaceFile } from '../utils/fs';
import { loadPrettier, PrettierApi, PrettierLoader } from './prettier';

/** Prettier's API reads no ignore file unless told which; its CLI reads this one from the cwd. */
const IGNORE_FILE = '.prettierignore';

/**
 * Formats the files a command wrote with the project's own Prettier and config, so they read in
 * the project's style rather than the templates'. Without Prettier, or without a Prettier config,
 * the files stay exactly as generated.
 *
 * Formatting never fails a command: the files were written either way. A file that cannot be
 * formatted keeps its generated content, and one warning names it and the reason.
 */
export async function formatWrittenFiles(
    cwd: string,
    files: readonly string[],
    load: PrettierLoader = loadPrettier
): Promise<void> {
    if (files.length === 0) return;

    let prettier: PrettierApi | null;
    try {
        prettier = load(cwd);
    } catch (error: unknown) {
        for (const file of files) warn(cwd, file, error);
        return;
    }
    if (prettier === null) return;

    for (const file of files) {
        try {
            await formatFile(prettier, cwd, file);
        } catch (error: unknown) {
            warn(cwd, file, error);
        }
    }
}

async function formatFile(prettier: PrettierApi, cwd: string, file: string): Promise<void> {
    if ((await prettier.resolveConfigFile(file)) === null) return;

    const info = await prettier.getFileInfo(file, { ignorePath: path.join(cwd, IGNORE_FILE), resolveConfig: true });
    if (info.ignored || info.inferredParser === null) return;

    // editorconfig matches the Prettier CLI, which reads .editorconfig beneath the project's config.
    const config = (await prettier.resolveConfig(file, { editorconfig: true })) ?? {};
    const source = fs.readFileSync(file, 'utf-8');
    const formatted = await prettier.format(source, { ...config, filepath: file });
    if (formatted !== source) replaceFile(file, formatted);
}

function warn(cwd: string, file: string, error: unknown): void {
    console.warn(`⚠️  Did not format ${path.relative(cwd, file) || file} (${reason(error)}); kept it as generated`);
}

/** The first line only: Prettier's syntax errors and Node's resolution errors run to many. */
function reason(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.split('\n')[0].trim() || 'unknown error';
}
