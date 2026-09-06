import { componentDir } from '../../stack/registry';
import { RenderContext } from '../context';

export function renderContainer(
    ctx: RenderContext,
    containerName: string,
    entity: string,
    fromFile: string
): string {
    const header = ctx.profile.clientDirective ? "'use client';\n\n" : '';
    const hookName = `use${entity}`;
    const hookPath = ctx.importLayer(fromFile, 'hook', hookName);
    const componentPath = ctx.importFrom(fromFile, `${componentDir(ctx.profile, 'client')}/${entity}`);

    return `${header}import { ${hookName} } from '${hookPath}';
import ${entity} from '${componentPath}';

export default function ${containerName}() {
  const { items, loading, error } = ${hookName}();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {items.map((item) => (
        <${entity} key={item.id} {...item} />
      ))}
    </div>
  );
}
`;
}
