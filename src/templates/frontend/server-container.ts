import { componentDir } from '../../stack/registry';
import { ActionSpec } from '../actions';
import { RenderContext } from '../context';
import { returnsList } from './http';

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

/** What a container for a read with query input can import beyond its own schema and service. */
export interface QueryContainerWiring {
    /** The `<Entity>` client component exists, so the records render through it. */
    readonly component: boolean;
}

function renderRecords(entity: string, many: boolean, component: boolean): string {
    if (!many) return component ? `  return <${entity} {...data} />;` : '  return <div>{data.id}</div>;';
    const item = component ? `<${entity} key={item.id} {...item} />` : '<div key={item.id}>{item.id}</div>';
    return `  return (
    <div>
      {data.map((item) => (
        ${item}
      ))}
    </div>
  );`;
}

/**
 * The read side of a GET that takes input, on a Server Actions stack. Its input is the page's query
 * string: Next 16 hands a page its `searchParams` as a Promise, and the page passes it through. The
 * container parses it with the action's schema, so the service only ever sees valid input, and an
 * invalid query string renders a message instead of throwing. On one record the page passes the id.
 */
export function renderQueryContainer(
    ctx: RenderContext,
    spec: ActionSpec,
    entity: string,
    fromFile: string,
    wiring: QueryContainerWiring
): string {
    const containerName = `${spec.name}Container`;
    const schema = `${spec.schema ?? spec.name}Schema`;
    const componentPath = ctx.importFrom(fromFile, `${componentDir(ctx.profile, 'client')}/${entity}`);
    const imports = [
        "import { connection } from 'next/server';",
        ...(wiring.component ? [`import ${entity} from '${componentPath}';`] : []),
        `import { ${schema} } from '${ctx.importLayer(fromFile, 'schema', `${spec.schema ?? spec.name}.schema`)}';`,
        `import { ${spec.name}Service } from '${ctx.importLayer(fromFile, 'serverService', `${spec.name}.service`)}';`,
    ];
    const idProp = spec.usesId ? '\n  id: string;' : '';
    const props = spec.usesId ? '{ id, searchParams }' : '{ searchParams }';
    const args = spec.usesId ? 'id, parsed.data' : 'parsed.data';

    return `${imports.join('\n')}

const service = new ${spec.name}Service();

type ${containerName}Props = {${idProp}
  /** The page's own searchParams prop, passed through as Next gives it. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ${containerName}(${props}: ${containerName}Props) {
  // Read on every request, not once at build time.
  await connection();
  const parsed = ${schema}.safeParse(await searchParams);
  if (!parsed.success) return <div>Invalid search parameters</div>;
  const data = await service.handle(${args});

${renderRecords(entity, returnsList(spec), wiring.component)}
}
`;
}
