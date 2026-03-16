import * as fs from 'fs';
import * as path from 'path';

function renderHook(name: string): string {
    return `import { useState } from 'react';

export function ${name}() {
  const [data, setData] = useState(null);

  return { data };
}
`;
}

export function makeHook(feature: string, name: string) {
    const base = path.join(process.cwd(), 'app', feature, 'hooks');

    if (!fs.existsSync(base)) {
        console.error(`❌ Feature "${feature}" does not exist. Run make:feature ${feature} first.`);
        process.exit(1);
    }

    const filePath = path.join(base, `${name}.ts`);

    if (fs.existsSync(filePath)) {
        console.error(`❌ Hook "${name}" already exists at ${filePath}`);
        process.exit(1);
    }

    fs.writeFileSync(filePath, renderHook(name));
    console.log(`✅ Hook "${name}" created at ${filePath}`);
}