import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { renderServerContainer } from '../frontend/server-container';
import { contextFor } from '../../__tests__/helpers/context';
import { createTempProject, TempProject } from '../../__tests__/helpers/project';

let project: TempProject;

beforeEach(() => {
    project = createTempProject('server-container');
});

afterEach(() => project.cleanup());

const ctx = () => contextFor('next-fullstack', 'projects');
const containerFile = (name: string): string => path.join(ctx().featureDir, 'containers', `${name}.tsx`);

describe('renderServerContainer', () => {
    it('reads through the List service on each request and hands the records to the client component', () => {
        const content = renderServerContainer(ctx(), 'ProjectContainer', 'Project', containerFile('ProjectContainer'), {
            listService: true,
            component: true,
        });
        expect(content).toBe(`import { connection } from 'next/server';
import Project from '../components/client/Project';
import { ListProjectService } from '../server/services/ListProject.service';

const service = new ListProjectService();

export default async function ProjectContainer() {
  // Read on every request, not once at build time.
  await connection();
  const data = await service.handle();

  return (
    <div>
      {data.map((item) => (
        <Project key={item.id} {...item} />
      ))}
    </div>
  );
}
`);
    });

    it('renders each record id when the component does not exist', () => {
        const content = renderServerContainer(ctx(), 'ProjectContainer', 'Project', containerFile('ProjectContainer'), {
            listService: true,
            component: false,
        });
        expect(content).not.toContain('components/');
        expect(content).toContain('<div key={item.id}>{item.id}</div>');
        expect(content).toContain("import { ListProjectService } from '../server/services/ListProject.service';");
    });

    it('calls no service when the name has no List service, and is still a Server Component', () => {
        const content = renderServerContainer(ctx(), 'ProjectDetailContainer', 'ProjectDetail', containerFile('ProjectDetailContainer'), {
            listService: false,
            component: false,
        });
        expect(content).toBe(`export default async function ProjectDetailContainer() {
  // Call this feature's services here and pass what they return to its client components.
  return <div>ProjectDetail</div>;
}
`);
    });

    it('never marks itself a client component', () => {
        const content = renderServerContainer(ctx(), 'ProjectContainer', 'Project', containerFile('ProjectContainer'), {
            listService: true,
            component: true,
        });
        expect(content).not.toContain("'use client'");
        expect(content).not.toContain('useList');
    });
});
