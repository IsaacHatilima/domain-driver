import * as fs from 'fs';
import * as path from 'path';

function renderContainer(name: string): string {
    return `'use client';

interface Props {}

export default function ${name}({ }: Props) {
  return (
    <div>
      <h1>${name}</h1>
    </div>
  );
}
`;
}

export function makeContainer(feature: string, name: string) {
    const base = path.join(process.cwd(), 'app', feature, 'containers');

    if (!fs.existsSync(base)) {
        console.error(`❌ Feature "${feature}" does not exist. Run make:feature ${feature} first.`);
        process.exit(1);
    }

    const filePath = path.join(base, `${name}.tsx`);

    if (fs.existsSync(filePath)) {
        console.error(`❌ Container "${name}" already exists at ${filePath}`);
        process.exit(1);
    }

    fs.writeFileSync(filePath, renderContainer(name));
    console.log(`✅ Container "${name}" created at ${filePath}`);
}