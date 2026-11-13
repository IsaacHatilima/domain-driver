import { componentDir } from '../../stack/registry';
import { RenderContext } from '../context';

/** What the container can import. It never imports a hook or a component that does not exist. */
export interface ContainerWiring {
    /** `List<Entity>.hook.ts` exists, so the container lists the records through it. */
    readonly listHook: boolean;
    /** The `<Entity>` component exists, so each record renders through it. */
    readonly component: boolean;
}

function renderUnwired(containerName: string): string {
    const label = containerName.replace(/Container$/, '') || containerName;
    return `export default function ${containerName}() {
  // Call this feature's hooks here and pass what they return to its components.
  return <div>${label}</div>;
}
`;
}

function renderList(ctx: RenderContext, containerName: string, entity: string, fromFile: string, component: boolean): string {
    const hookName = `useList${entity}`;
    const hookPath = ctx.importLayer(fromFile, 'hook', `List${entity}.hook`);
    const componentPath = ctx.importFrom(fromFile, `${componentDir(ctx.profile, 'client')}/${entity}`);
    const query = ctx.profile.queryHooks;
    const loadingField = query ? 'isPending' : 'loading';
    const errorExpression = query ? '{error.message}' : '{error}';
    const items = query ? '(data ?? [])' : 'data';
    const imports = [
        `import { ${hookName} } from '${hookPath}';`,
        ...(component ? [`import ${entity} from '${componentPath}';`] : []),
    ];
    const item = component ? `<${entity} key={item.id} {...item} />` : '<div key={item.id}>{item.id}</div>';

    return `${imports.join('\n')}

export default function ${containerName}() {
  const { data, ${loadingField}, error } = ${hookName}();

  if (${loadingField}) return <div>Loading...</div>;
  if (error) return <div>Error: ${errorExpression}</div>;

  return (
    <div>
      {${items}.map((item) => (
        ${item}
      ))}
    </div>
  );
}
`;
}

export function renderContainer(
    ctx: RenderContext,
    containerName: string,
    entity: string,
    fromFile: string,
    wiring: ContainerWiring
): string {
    const header = ctx.profile.clientDirective ? "'use client';\n\n" : '';
    const body = wiring.listHook
        ? renderList(ctx, containerName, entity, fromFile, wiring.component)
        : renderUnwired(containerName);
    return `${header}${body}`;
}
