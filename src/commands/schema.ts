import * as path from 'path';
import { ensureFeatureExists, writeFileSafe, fileExists } from '../utils';

type SchemaAction = 'Create' | 'Update';

const SCHEMA_ACTIONS: SchemaAction[] = ['Create', 'Update'];

function renderSchema(action: SchemaAction, name: string): string {
    switch (action) {
        case 'Create':
            return `import { z } from 'zod';

export const Create${name}Schema = z.object({
  // add create fields here
});

export type Create${name} = z.infer<typeof Create${name}Schema>;
`;
        case 'Update':
            return `import { z } from 'zod';

export const Update${name}Schema = z.object({
  id: z.string(),
  // add update fields here
});

export type Update${name} = z.infer<typeof Update${name}Schema>;
`;
    }
}

export function makeSchema(feature: string, name: string): void {
    const base = ensureFeatureExists(feature, 'schemas');

    for (const action of SCHEMA_ACTIONS) {
        const filePath = path.join(base, `${action}${name}.schema.ts`);

        if (fileExists(filePath)) {
            console.warn(`⚠️  Skipping "${action}${name}.schema.ts" — already exists`);
            continue;
        }

        writeFileSafe(filePath, renderSchema(action, name));
    }

    console.log(`✅ Schemas for "${name}" created at ${base}`);
}
