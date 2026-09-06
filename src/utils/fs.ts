import * as fs from 'fs';

export function writeFileSafe(filePath: string, content: string): void {
    try {
        fs.writeFileSync(filePath, content);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to write ${filePath}: ${message}`);
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

export function readTextFile(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
}
