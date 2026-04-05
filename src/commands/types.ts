import * as path from 'path';
import { ensureFeatureExists, writeFileSafe, fileExists } from '../utils';

function renderTypes(name: string): string {
    return `export interface ${name} {
  id: string;
  // add ${name} fields here
  createdAt: string;
  updatedAt: string;
}
`;
}

export function makeTypes(feature: string, name: string): void {
    const base = ensureFeatureExists(feature, 'types');
    const filePath = path.join(base, `${name}.types.ts`);

    if (fileExists(filePath)) {
        console.warn(`⚠️  Skipping "${name}.types.ts" — already exists`);
        return;
    }

    writeFileSafe(filePath, renderTypes(name));
    console.log(`✅ Types for "${name}" created at ${filePath}`);
}
