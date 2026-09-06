import { ACTIONS } from '../actions';
import { RenderContext } from '../context';

function serviceImports(ctx: RenderContext, fromFile: string, entity: string): string {
    return ACTIONS.map((action) => {
        const servicePath = ctx.importLayer(fromFile, 'clientService', `${action}${entity}.service`);
        return `import { ${action}${entity}Service } from '${servicePath}';`;
    }).join('\n');
}

function serviceInstances(entity: string): string {
    return ACTIONS.map(
        (action) => `const ${action.toLowerCase()}Service = new ${action}${entity}Service();`
    ).join('\n');
}

export function renderHook(ctx: RenderContext, hookName: string, entity: string, fromFile: string): string {
    const header = ctx.profile.clientDirective ? "'use client';\n\n" : '';
    const typePath = ctx.importLayer(fromFile, 'types', `${entity}.types`);
    const createPath = ctx.importLayer(fromFile, 'schema', `Create${entity}.schema`);
    const updatePath = ctx.importLayer(fromFile, 'schema', `Update${entity}.schema`);

    return `${header}import { useState, useEffect, useCallback } from 'react';
import { ${entity} } from '${typePath}';
${serviceImports(ctx, fromFile, entity)}
import { Create${entity} } from '${createPath}';
import { Update${entity} } from '${updatePath}';

${serviceInstances(entity)}

export function ${hookName}() {
  const [items, setItems] = useState<${entity}[]>([]);
  const [selected, setSelected] = useState<${entity} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listService.handle();
      setItems(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOne = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await showService.handle(id);
      setSelected(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: Create${entity}) => {
    setLoading(true);
    setError(null);
    try {
      const created = await createService.handle(data);
      setItems((prev) => [...prev, created]);
      return created;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (id: string, data: Update${entity}) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateService.handle(id, data);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await deleteService.handle(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { items, selected, loading, error, fetchAll, fetchOne, create, update, remove };
}
`;
}
