import * as path from 'path';
import { ensureFeatureExists, writeFileSafe, fileExists } from '../utils';

type ComponentType = 'client' | 'server';

function renderComponent(name: string, type: ComponentType): string {
    const directive = type === 'client' ? "'use client';\n\n" : '';

    return `${directive}interface ${name}Props {
  id: string;
}

export default function ${name}({ id }: ${name}Props) {
  return (
    <div>
      <h1>${name}</h1>
    </div>
  );
}
`;
}

export function makeComponent(feature: string, name: string, type: ComponentType = 'client'): void {
    const base = ensureFeatureExists(feature, `components/${type}`);
    const filePath = path.join(base, `${name}.tsx`);

    if (fileExists(filePath)) {
        throw new Error(`Component "${name}" already exists at ${filePath}`);
    }

    writeFileSafe(filePath, renderComponent(name, type));
    console.log(`✅ Component "${name}" created at ${filePath}`);
}
