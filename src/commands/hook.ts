import * as path from 'path';
import { ensureFeatureExists, writeFileSafe, fileExists, resolveImport } from '../utils';

function renderHook(hookName: string, name: string, feature: string): string {
    const typePath = resolveImport(feature, `types/${name}.types`);
    const svcPath = (op: string) => resolveImport(feature, `services/${op}${name}.service`);
    const schemaPath = (op: string) => resolveImport(feature, `schemas/${op}${name}.schema`);

    return `'use client';

import { useState, useEffect, useCallback } from 'react';
import { ${name} } from '${typePath}';
import { List${name}Service } from '${svcPath('List')}';
import { Show${name}Service } from '${svcPath('Show')}';
import { Create${name}Service } from '${svcPath('Create')}';
import { Update${name}Service } from '${svcPath('Update')}';
import { Delete${name}Service } from '${svcPath('Delete')}';
import { Create${name} } from '${schemaPath('Create')}';
import { Update${name} } from '${schemaPath('Update')}';

const listService = new List${name}Service();
const showService = new Show${name}Service();
const createService = new Create${name}Service();
const updateService = new Update${name}Service();
const deleteService = new Delete${name}Service();

export function ${hookName}() {
  const [items, setItems] = useState<${name}[]>([]);
  const [selected, setSelected] = useState<${name} | null>(null);
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

  const create = useCallback(async (data: Create${name}) => {
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

  const update = useCallback(async (id: string, data: Update${name}) => {
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

export function makeHook(feature: string, name: string, pascalName?: string): void {
    const base = ensureFeatureExists(feature, 'hooks');
    const filePath = path.join(base, `${name}.ts`);

    if (fileExists(filePath)) {
        throw new Error(`Hook "${name}" already exists at ${filePath}`);
    }

    const entityName = pascalName ?? name.replace(/^use/, '');
    writeFileSafe(filePath, renderHook(name, entityName, feature));
    console.log(`✅ Hook "${name}" created at ${filePath}`);
}
