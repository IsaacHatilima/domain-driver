import { componentDir } from '../../stack/registry';
import { RenderContext } from '../context';

/** What a Server Component container can import. It never imports a service or component that does not exist. */
export interface ServerContainerWiring {
    /** `server/services/List<Entity>.service.ts` exists, so the container reads the records through it. */
    readonly listService: boolean;
    /** The `<Entity>` client component exists, so each record renders through it. */
    readonly component: boolean;
}

function renderUnwired(containerName: string): string {
    const label = containerName.replace(/Container$/, '') || containerName;
    return `export default async function ${containerName}() {
  // Call this feature's services here and pass what they return to its client components.
  return <div>${label}</div>;
}
`;
}

/**
 * `connection()` makes the page render per request. Without it Next prerenders the page at build
 * time, which runs the repository then: before it is wired that fails the build, and after, it
 * freezes the build's data into the page.
 */
function renderList(ctx: RenderContext, containerName: string, entity: string, fromFile: string, component: boolean): string {
    const serviceClass = `List${entity}Service`;
    const servicePath = ctx.importLayer(fromFile, 'serverService', `List${entity}.service`);
    const componentPath = ctx.importFrom(fromFile, `${componentDir(ctx.profile, 'client')}/${entity}`);
    const imports = [
        "import { connection } from 'next/server';",
        ...(component ? [`import ${entity} from '${componentPath}';`] : []),
        `import { ${serviceClass} } from '${servicePath}';`,
    ];
    const item = component ? `<${entity} key={item.id} {...item} />` : '<div key={item.id}>{item.id}</div>';

    return `${imports.join('\n')}

const service = new ${serviceClass}();

export default async function ${containerName}() {
  // Read on every request, not once at build time.
  await connection();
  const data = await service.handle();

  return (
    <div>
      {data.map((item) => (
        ${item}
      ))}
    </div>
  );
}
`;
}

/**
 * The read side of a Server Actions feature: an async Server Component that calls the List service
 * directly and hands the records to the client component, with no API and no fetch in between.
 */
export function renderServerContainer(
    ctx: RenderContext,
    containerName: string,
    entity: string,
    fromFile: string,
    wiring: ServerContainerWiring
): string {
    return wiring.listService
        ? renderList(ctx, containerName, entity, fromFile, wiring.component)
        : renderUnwired(containerName);
}
