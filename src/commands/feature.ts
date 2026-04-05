import * as path from 'path';
import { toPascalCase, featureBasePath, writeFileSafe, mkdirSafe, fileExists, resolveImport } from '../utils';
import { makeComponent } from './component';
import { makeHook } from './hook';
import { makeService } from './service';
import { makeRepository } from './repository';
import { makeSchema } from './schema';
import { makeContainer } from './container';
import { makeTypes } from './types';

const FEATURE_DIRS = [
    'components/server',
    'components/client',
    'containers',
    'hooks',
    'services',
    'repositories',
    'schemas',
    'types',
];

function renderPage(name: string, pascalName: string): string {
    const containerPath = resolveImport(name, `containers/${pascalName}Container`, true);

    return `import ${pascalName}Container from '${containerPath}';

export default function ${pascalName}Page() {
  return (
    <div>
      <${pascalName}Container />
    </div>
  );
}
`;
}

export async function makeFeature(name: string, all: boolean = false): Promise<void> {
    const base = featureBasePath(name);
    const pascalName = toPascalCase(name);

    if (fileExists(base)) {
        throw new Error(`Feature "${name}" already exists at ${base}`);
    }

    for (const dir of FEATURE_DIRS) {
        mkdirSafe(path.join(base, dir));
        if (!all) {
            writeFileSafe(path.join(base, dir, '.gitkeep'), '');
        }
    }

    if (all) {
        writeFileSafe(path.join(base, 'page.tsx'), renderPage(name, pascalName));
    } else {
        writeFileSafe(
            path.join(base, 'page.tsx'),
            `export default function ${pascalName}Page() {\n  return (\n    <div>\n      <h1>${pascalName}</h1>\n    </div>\n  );\n}\n`
        );
    }

    console.log(`✅ Feature "${name}" scaffolded at ${base}`);

    if (all) {
        makeTypes(name, pascalName);
        makeSchema(name, pascalName);
        makeRepository(name, pascalName);
        makeService(name, pascalName);
        makeHook(name, `use${pascalName}`, pascalName);
        makeComponent(name, pascalName, 'client');
        makeContainer(name, `${pascalName}Container`, pascalName);

        console.log(`✅ All files scaffolded for "${name}"`);
    }
}
