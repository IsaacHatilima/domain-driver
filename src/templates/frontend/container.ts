import { componentDir } from '../../stack/registry';
import { RenderContext } from '../context';

export function renderContainer(
    ctx: RenderContext,
    containerName: string,
    entity: string,
    fromFile: string
): string {
    const header = ctx.profile.clientDirective ? "'use client';\n\n" : '';
    const hookName = `useList${entity}`;
    const hookPath = ctx.importLayer(fromFile, 'hook', `List${entity}.hook`);
    const componentPath = ctx.importFrom(fromFile, `${componentDir(ctx.profile, 'client')}/${entity}`);
    const query = ctx.profile.queryHooks;
    const loadingField = query ? 'isPending' : 'loading';
    const errorExpression = query ? '{error.message}' : '{error}';
    const items = query ? '(data ?? [])' : 'data';

    return `${header}import { ${hookName} } from '${hookPath}';
import ${entity} from '${componentPath}';

export default function ${containerName}() {
  const { data, ${loadingField}, error } = ${hookName}();

  if (${loadingField}) return <div>Loading...</div>;
  if (error) return <div>Error: ${errorExpression}</div>;

  return (
    <div>
      {${items}.map((item) => (
        <${entity} key={item.id} {...item} />
      ))}
    </div>
  );
}
`;
}
