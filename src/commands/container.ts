import * as path from 'path';
import { ensureFeatureExists, writeFileSafe, fileExists, resolveImport } from '../utils';

function renderContainer(containerName: string, name: string, feature: string): string {
    const hookName = `use${name}`;
    const hookPath = resolveImport(feature, `hooks/${hookName}`);
    const componentPath = resolveImport(feature, `components/client/${name}`);

    return `'use client';

import { ${hookName} } from '${hookPath}';
import ${name} from '${componentPath}';

export default function ${containerName}() {
  const { items, loading, error } = ${hookName}();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {items.map((item) => (
        <${name} key={item.id} {...item} />
      ))}
    </div>
  );
}
`;
}

export function makeContainer(feature: string, name: string, pascalName?: string): void {
    const base = ensureFeatureExists(feature, 'containers');
    const filePath = path.join(base, `${name}.tsx`);

    if (fileExists(filePath)) {
        throw new Error(`Container "${name}" already exists at ${filePath}`);
    }

    const entityName = pascalName ?? name.replace(/Container$/, '');
    writeFileSafe(filePath, renderContainer(name, entityName, feature));
    console.log(`✅ Container "${name}" created at ${filePath}`);
}
