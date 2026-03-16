import * as fs from 'fs';
import * as path from 'path';

type ComponentType = 'client' | 'server';

function renderComponent(name: string, type: ComponentType): string {
    const directive = type === 'client' ? "'use client';\n\n" : '';

    return `${directive}export default function ${name}() {
  return (
    <div>
      <h1>${name}</h1>
    </div>
  );
}
`;
}

export function makeComponent(feature: string, name: string, type: ComponentType = 'client') {
    const base = path.join(process.cwd(), 'app', feature, 'components', type);

    if (!fs.existsSync(base)) {
        console.error(`❌ Feature "${feature}" does not exist. Run make:feature ${feature} first.`);
        process.exit(1);
    }

    const filePath = path.join(base, `${name}.tsx`);

    if (fs.existsSync(filePath)) {
        console.error(`❌ Component "${name}" already exists at ${filePath}`);
        process.exit(1);
    }

    fs.writeFileSync(filePath, renderComponent(name, type));
    console.log(`✅ Component "${name}" created at ${filePath}`);
}