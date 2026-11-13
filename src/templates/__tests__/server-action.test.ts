import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { customAction, standardAction } from '../actions';
import { featureUrl, renderServerAction } from '../controllers/next-server-action';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, writeTsconfig, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('server-action');
});

afterEach(() => project.cleanup());

const ctx = () => contextFor('next-fullstack', 'projects');
const actionFile = (name: string): string => path.join(ctx().featureDir, 'server', 'actions', `${name}.action.ts`);

describe('renderServerAction', () => {
    it('renders a create that validates the form, delegates, revalidates and fails closed', () => {
        const content = renderServerAction(ctx(), standardAction('Create', 'Project'), 'Project', actionFile('CreateProject'));
        expect(content).toBe(`'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CreateProjectSchema, type CreateProject } from '../../schemas/CreateProject.schema';
import { CreateProjectService } from '../services/CreateProject.service';

export type CreateProjectState =
  | { status: 'idle' }
  | { status: 'invalid'; errors: Partial<Record<keyof CreateProject, string[]>> }
  | { status: 'saved' };

const service = new CreateProjectService();

/**
 * Fails closed until the caller is checked. Replace \`await requireCaller();\` in
 * createProjectAction with the project's session check, such as
 * \`const { user } = await requireSession();\`, then delete this function.
 */
async function requireCaller(): Promise<void> {
  throw new Error('createProjectAction does not check the caller yet');
}

export async function createProjectAction(
  _previous: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  await requireCaller();

  const parsed = CreateProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: 'invalid', errors: z.flattenError(parsed.error).fieldErrors };
  }

  await service.handle(parsed.data);
  revalidatePath('/projects');
  return { status: 'saved' };
}
`);
    });

    it('takes the record id of an on-record action from the form and validates it with the entity schema', () => {
        const spec = customAction('Project', 'archiveProject', { withInput: false, returns: 'one', method: 'post', onRecord: true });
        const content = renderServerAction(ctx(), spec, 'Project', actionFile('ArchiveProject'));
        expect(content).toBe(`'use server';

import { revalidatePath } from 'next/cache';
import { ProjectSchema } from '../../schemas/Project.schema';
import { ArchiveProjectService } from '../services/ArchiveProject.service';

export type ArchiveProjectState =
  | { status: 'idle' }
  | { status: 'invalid'; errors: Partial<Record<'id', string[]>> }
  | { status: 'saved' };

const service = new ArchiveProjectService();

/**
 * Fails closed until the caller is checked. Replace \`await requireCaller();\` in
 * archiveProjectAction with the project's session check, such as
 * \`const { user } = await requireSession();\`, then delete this function.
 */
async function requireCaller(): Promise<void> {
  throw new Error('archiveProjectAction does not check the caller yet');
}

export async function archiveProjectAction(
  _previous: ArchiveProjectState,
  formData: FormData,
): Promise<ArchiveProjectState> {
  await requireCaller();

  const id = ProjectSchema.shape.id.safeParse(formData.get('id'));
  if (!id.success) {
    return { status: 'invalid', errors: { id: id.error.issues.map((issue) => issue.message) } };
  }

  await service.handle(id.data);
  revalidatePath('/projects');
  return { status: 'saved' };
}
`);
    });

    it('validates the id, then the body, for an update', () => {
        const content = renderServerAction(ctx(), standardAction('Update', 'Project'), 'Project', actionFile('UpdateProject'));
        expect(content).toContain("import { z } from 'zod';");
        expect(content).toContain("import { ProjectSchema } from '../../schemas/Project.schema';");
        expect(content).toContain("import { UpdateProjectSchema, type UpdateProject } from '../../schemas/UpdateProject.schema';");
        expect(content).toContain("  | { status: 'invalid'; errors: Partial<Record<keyof UpdateProject | 'id', string[]>> }");
        const idCheck = content.indexOf("ProjectSchema.shape.id.safeParse(formData.get('id'))");
        const bodyCheck = content.indexOf('UpdateProjectSchema.safeParse(Object.fromEntries(formData))');
        const callerCheck = content.indexOf('  await requireCaller();');
        expect(callerCheck).toBeGreaterThan(-1);
        expect(idCheck).toBeGreaterThan(callerCheck);
        expect(bodyCheck).toBeGreaterThan(idCheck);
        expect(content).toContain('  await service.handle(id.data, parsed.data);\n  revalidatePath(\'/projects\');');
        expect(content).toContain('export async function updateProjectAction(');
    });

    it('passes only the id to a delete', () => {
        const content = renderServerAction(ctx(), standardAction('Delete', 'Project'), 'Project', actionFile('DeleteProject'));
        expect(content).not.toContain("from 'zod'");
        expect(content).toContain('  await service.handle(id.data);');
        expect(content).toContain('export async function deleteProjectAction(');
    });

    it('has no invalid state when there is nothing to validate', () => {
        const spec = customAction('Project', 'purgeArchivedProjects', { withInput: false, returns: 'void', method: 'post' });
        const content = renderServerAction(ctx(), spec, 'Project', actionFile('PurgeArchivedProjects'));
        expect(content).toContain(`export type PurgeArchivedProjectsState =
  | { status: 'idle' }
  | { status: 'saved' };`);
        expect(content).toContain('  _previous: PurgeArchivedProjectsState,\n  _formData: FormData,\n');
        expect(content).toContain('  await requireCaller();\n\n  await service.handle();');
        expect(content).not.toContain('safeParse');
        expect(content).not.toContain("'invalid'");
    });

    it('validates a custom action body with its own schema', () => {
        const spec = customAction('Project', 'renameProject', { withInput: true, returns: 'one', method: 'patch', onRecord: true });
        const content = renderServerAction(ctx(), spec, 'Project', actionFile('RenameProject'));
        expect(content).toContain("import { RenameProjectSchema, type RenameProject } from '../../schemas/RenameProject.schema';");
        expect(content).toContain('  await service.handle(id.data, parsed.data);');
    });

    it('imports through the path alias when one is configured', () => {
        writeTsconfig({ '@/*': ['./*'] });
        const content = renderServerAction(ctx(), standardAction('Create', 'Project'), 'Project', actionFile('CreateProject'));
        expect(content).toContain("from '@/app/projects/schemas/CreateProject.schema';");
        expect(content).toContain("from '@/app/projects/server/services/CreateProject.service';");
    });
});

describe('featureUrl', () => {
    it('is the feature folder under the app directory', () => {
        expect(featureUrl(ctx())).toBe('/projects');
    });

    it('keeps the folders a relocated root adds, without route groups or slots', () => {
        const nested = contextFor('next-fullstack', 'projects', { featureRoot: 'src/app/(dashboard)/@main/admin', apiRoot: 'src/app/api' });
        expect(featureUrl(nested)).toBe('/admin/projects');
    });

    it('falls back to the feature name for a root outside the app directory', () => {
        const outside = contextFor('next-fullstack', 'projects', { featureRoot: 'src/features' });
        expect(featureUrl(outside)).toBe('/projects');
    });

    it('revalidates a path with a dynamic segment as a page pattern', () => {
        const dynamic = contextFor('next-fullstack', 'projects', { featureRoot: 'app/[team]' });
        const content = renderServerAction(dynamic, standardAction('Delete', 'Project'), 'Project', path.join(dynamic.featureDir, 'server/actions/DeleteProject.action.ts'));
        expect(content).toContain("revalidatePath('/[team]/projects', 'page');");
    });
});
