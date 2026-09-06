export function renderSchema(name: string, label: string): string {
    return `import { z } from 'zod';

export const ${name}Schema = z.object({
  // add ${label} fields here
});

export type ${name} = z.infer<typeof ${name}Schema>;
`;
}
