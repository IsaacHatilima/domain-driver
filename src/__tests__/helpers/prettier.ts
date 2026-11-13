import * as fs from 'fs';
import * as path from 'path';

/**
 * A stand-in for the project's own `prettier`, installed into the temp project's node_modules so
 * the CLI resolves it the way it resolves the real one. It answers the calls domain-driver makes,
 * as Prettier 3's CommonJS entry does (every call async), and models what the tests need:
 * - `resolveConfigFile`/`resolveConfig` read `.prettierrc` (JSON) from the file's folder upward;
 * - `getFileInfo` honours only the ignore file passed as `ignorePath`, as Prettier's API does;
 * - `format` loads each plugin named in the options from the working directory, as Prettier 3
 *   does, so a plugin that is not installed fails the same way; then `semi: false` drops
 *   line-ending semicolons and `singleQuote: false` turns single quotes double.
 */
const FAKE_PRETTIER = `
const fs = require('fs');
const path = require('path');

function findConfig(dir) {
    for (let current = dir; ; current = path.dirname(current)) {
        const file = path.join(current, '.prettierrc');
        if (fs.existsSync(file)) return file;
        if (path.dirname(current) === current) return null;
    }
}

exports.resolveConfigFile = async (file) => findConfig(path.dirname(file));

exports.resolveConfig = async (file) => {
    const configFile = findConfig(path.dirname(file));
    return configFile === null ? null : JSON.parse(fs.readFileSync(configFile, 'utf-8'));
};

exports.getFileInfo = async (file, options = {}) => {
    const inferredParser = /\\.tsx?$/.test(file) ? 'typescript' : null;
    const ignoreFile = options.ignorePath;
    if (ignoreFile === undefined || !fs.existsSync(ignoreFile)) return { ignored: false, inferredParser };
    const relative = path.relative(path.dirname(ignoreFile), file).split(path.sep).join('/');
    const ignored = fs
        .readFileSync(ignoreFile, 'utf-8')
        .split('\\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .some((pattern) => relative === pattern || relative.startsWith(pattern.endsWith('/') ? pattern : pattern + '/'));
    return { ignored, inferredParser: ignored ? null : inferredParser };
};

exports.format = async (source, options) => {
    for (const plugin of options.plugins || []) require(require.resolve(plugin, { paths: [process.cwd()] }));
    let output = source;
    if (options.semi === false) output = output.replace(/;$/gm, '');
    if (options.singleQuote === false) output = output.replace(/'/g, '"');
    return output;
};
`;

function projectPath(relative: string): string {
    return path.join(process.cwd(), relative);
}

export function installFakePrettier(): void {
    const dir = projectPath('node_modules/prettier');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'prettier', version: '3.0.0', main: 'index.js' }));
    fs.writeFileSync(path.join(dir, 'index.js'), FAKE_PRETTIER);
}

/** A `prettier` package that loads but is not Prettier's API, as a broken install would be. */
export function installBrokenPrettier(): void {
    const dir = projectPath('node_modules/prettier');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'prettier', version: '0.0.0', main: 'index.js' }));
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};\n');
}

export function writePrettierConfig(config: Record<string, unknown>): void {
    fs.writeFileSync(projectPath('.prettierrc'), JSON.stringify(config, null, 2));
}

export function writePrettierIgnore(patterns: readonly string[]): void {
    fs.writeFileSync(projectPath('.prettierignore'), `${patterns.join('\n')}\n`);
}

/** The Vite starter's Prettier style: no semicolons, double quotes. */
export const STARTER_STYLE = Object.freeze({ semi: false, singleQuote: false });
