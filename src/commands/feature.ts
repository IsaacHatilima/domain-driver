import * as fs from 'fs';
import * as path from 'path';
import { makeComponent } from './component';
import { makeHook } from './hook';
import { makeService } from './service';
import { makeRepository } from './repository';
import { makeSchema } from './schema';
import { makeContainer } from './container';

const FEATURE_DIRS = [
    'components/server',
    'components/client',
    'containers',
    'hooks',
    'services',
    'repositories',
    'schemas',
];

function toPascalCase(name: string): string {
    return name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

function renderPage(name: string): string {
    const componentName = toPascalCase(name);
    return `export default function ${componentName}Page() {
  return (
    <div>
      <h1>${componentName}</h1>
    </div>
  );
}
`;
}

export async function makeFeature(name: string, all: boolean = false) {
    const base = path.join(process.cwd(), 'app', name);
    const pascalName = toPascalCase(name);

    if (fs.existsSync(base)) {
        console.error(`❌ Feature "${name}" already exists at ${base}`);
        process.exit(1);
    }

    for (const dir of FEATURE_DIRS) {
        fs.mkdirSync(path.join(base, dir), { recursive: true });
        if (!all) {
            fs.writeFileSync(path.join(base, dir, '.gitkeep'), '');
        }
    }

    fs.writeFileSync(path.join(base, 'page.tsx'), renderPage(name));
    console.log(`✅ Feature "${name}" scaffolded at ${base}`);

    if (all) {
        makeComponent(name, pascalName, 'client');
        makeContainer(name, `${pascalName}Container`);
        makeHook(name, `use${pascalName}`);
        makeService(name, pascalName);
        makeRepository(name, `${pascalName}Repository`);
        makeSchema(name, `${pascalName}Schema`);

        console.log(`✅ All files scaffolded for "${name}"`);
    }
}