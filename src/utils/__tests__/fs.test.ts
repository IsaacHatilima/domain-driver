import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { writeFileSafe } from '../fs';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('fs');
});

afterEach(() => project.cleanup());

function folderWithPlaceholder(name: string): string {
    const dir = path.join(project.dir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.gitkeep'), '');
    return dir;
}

describe('writeFileSafe', () => {
    it('removes the folder placeholder once a real file lands in it', () => {
        const dir = folderWithPlaceholder('hooks');
        writeFileSafe(path.join(dir, 'ListCat.hook.ts'), 'export {};\n');

        expect(fs.readdirSync(dir)).toEqual(['ListCat.hook.ts']);
    });

    it('leaves the placeholders of other folders alone', () => {
        const hooks = folderWithPlaceholder('hooks');
        const types = folderWithPlaceholder('types');
        writeFileSafe(path.join(types, 'Cat.types.ts'), 'export {};\n');

        expect(fs.existsSync(path.join(hooks, '.gitkeep'))).toBe(true);
        expect(fs.existsSync(path.join(types, '.gitkeep'))).toBe(false);
    });

    it('writes the placeholder itself without removing it', () => {
        const dir = path.join(project.dir, 'schemas');
        fs.mkdirSync(dir);
        writeFileSafe(path.join(dir, '.gitkeep'), '');

        expect(fs.readdirSync(dir)).toEqual(['.gitkeep']);
    });

    it('writes into a folder that never had a placeholder', () => {
        const dir = path.join(project.dir, 'containers');
        fs.mkdirSync(dir);
        writeFileSafe(path.join(dir, 'CatContainer.tsx'), 'export {};\n');

        expect(fs.readdirSync(dir)).toEqual(['CatContainer.tsx']);
    });
});
