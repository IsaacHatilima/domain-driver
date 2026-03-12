import * as fs from 'fs';
import * as path from 'path';

const FEATURE_DIRS = [
    'components/server',
    'components/client',
    'containers',
    'hooks',
    'services',
    'repositories',
    'schemas',
];

function renderTemplate(name: string): string {
    const componentName = name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

    return `export default function ${componentName}Page() {
  return (
    <div>
      <h1>${componentName}</h1>
    </div>
  );
}
`;
}

export async function makeFeature(name: string) {
    const base = path.join(process.cwd(), 'app', name);

    for (const dir of FEATURE_DIRS) {
        fs.mkdirSync(path.join(base, dir), { recursive: true });
        fs.writeFileSync(path.join(base, dir, '.gitkeep'), '');
    }

    const page = renderTemplate(name);
    fs.writeFileSync(path.join(base, 'page.tsx'), page);

    console.log(`✅ Feature "${name}" scaffolded at ${base}`);
}