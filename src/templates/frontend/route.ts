import { RenderContext } from '../context';

export function renderRoute(
    ctx: RenderContext,
    entity: string,
    fromFile: string,
    withContainer: boolean
): string {
    const head = `import { createFileRoute } from '@tanstack/react-router';`;
    const routeBlock = `export const Route = createFileRoute('/${ctx.feature}/')({
  component: ${entity}Page,
});`;

    if (!withContainer) {
        return `${head}

${routeBlock}

function ${entity}Page() {
  return (
    <div>
      <h1>${entity}</h1>
    </div>
  );
}
`;
    }

    const containerPath = ctx.importLayer(fromFile, 'container', `${entity}Container`);
    return `${head}
import ${entity}Container from '${containerPath}';

${routeBlock}

function ${entity}Page() {
  return <${entity}Container />;
}
`;
}
