import { RenderContext } from '../context';

export function renderPage(
    ctx: RenderContext,
    entity: string,
    fromFile: string,
    withContainer: boolean
): string {
    if (!withContainer) {
        return `export default function ${entity}Page() {
  return (
    <div>
      <h1>${entity}</h1>
    </div>
  );
}
`;
    }

    const containerPath = ctx.importLayer(fromFile, 'container', `${entity}Container`);
    return `import ${entity}Container from '${containerPath}';

export default function ${entity}Page() {
  return (
    <div>
      <${entity}Container />
    </div>
  );
}
`;
}
