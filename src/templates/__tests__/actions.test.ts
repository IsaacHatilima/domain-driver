import { describe, it, expect } from 'vitest';
import { actionCase, customAction, HTTP_METHODS, isQueryAction, standardAction, standardActions, RETURN_KINDS } from '../actions';

describe('actionCase', () => {
    it('normalises camelCase and PascalCase', () => {
        expect(actionCase('findActiveUsers')).toEqual({
            pascal: 'FindActiveUsers',
            camel: 'findActiveUsers',
            slug: 'find-active-users',
        });
        expect(actionCase('FindActiveUsers').camel).toBe('findActiveUsers');
    });

    it.each(['find-active-users', 'find_active', 'find active', '1st', ''])('rejects %s', (name) => {
        expect(() => actionCase(name)).toThrow(
            `Action name "${name}" must be camelCase or PascalCase, for example findActiveUsers.`
        );
    });
});

describe('standardAction', () => {
    it('List', () => {
        expect(standardAction('List', 'Cat')).toEqual({
            name: 'ListCat',
            handler: 'listCatController',
            params: '',
            args: '',
            returns: 'Promise<Cat[]>',
            usesEntityType: true,
            schema: null,
            usesId: false,
            status: 200,
            method: 'get',
            path: '/',
            failure: 'Failed to fetch Cat list',
            custom: false,
        });
    });

    it('Show', () => {
        expect(standardAction('Show', 'Cat')).toEqual({
            name: 'ShowCat',
            handler: 'showCatController',
            params: 'id: string',
            args: 'id',
            returns: 'Promise<Cat>',
            usesEntityType: true,
            schema: null,
            usesId: true,
            status: 200,
            method: 'get',
            path: '/:id',
            failure: 'Failed to fetch Cat',
            custom: false,
        });
    });

    it('Create', () => {
        expect(standardAction('Create', 'Cat')).toEqual({
            name: 'CreateCat',
            handler: 'createCatController',
            params: 'data: CreateCat',
            args: 'data',
            returns: 'Promise<Cat>',
            usesEntityType: true,
            schema: 'CreateCat',
            usesId: false,
            status: 201,
            method: 'post',
            path: '/',
            failure: 'Failed to create Cat',
            custom: false,
        });
    });

    it('Update', () => {
        expect(standardAction('Update', 'Cat')).toEqual({
            name: 'UpdateCat',
            handler: 'updateCatController',
            params: 'id: string, data: UpdateCat',
            args: 'id, data',
            returns: 'Promise<Cat>',
            usesEntityType: true,
            schema: 'UpdateCat',
            usesId: true,
            status: 200,
            method: 'put',
            path: '/:id',
            failure: 'Failed to update Cat',
            custom: false,
        });
    });

    it('Delete', () => {
        expect(standardAction('Delete', 'Cat')).toEqual({
            name: 'DeleteCat',
            handler: 'deleteCatController',
            params: 'id: string',
            args: 'id',
            returns: 'Promise<void>',
            usesEntityType: false,
            schema: null,
            usesId: true,
            status: 204,
            method: 'delete',
            path: '/:id',
            failure: 'Failed to delete Cat',
            custom: false,
        });
    });

    it('standardActions returns the five in order, frozen', () => {
        const specs = standardActions('Cat');
        expect(specs.map((spec) => spec.name)).toEqual(['ListCat', 'ShowCat', 'CreateCat', 'UpdateCat', 'DeleteCat']);
        expect(specs.every((spec) => Object.isFrozen(spec))).toBe(true);
    });
});

describe('customAction', () => {
    it('no input, list', () => {
        expect(customAction('User', 'findActiveUsers', { withInput: false, returns: 'list' })).toEqual({
            name: 'FindActiveUsers',
            handler: 'findActiveUsersController',
            params: '',
            args: '',
            returns: 'Promise<User[]>',
            usesEntityType: true,
            schema: null,
            usesId: false,
            status: 200,
            method: 'get',
            path: '/find-active-users',
            failure: 'Failed to findActiveUsers User',
            custom: true,
        });
    });

    it('with input, one', () => {
        expect(customAction('User', 'archiveUser', { withInput: true, returns: 'one' })).toEqual({
            name: 'ArchiveUser',
            handler: 'archiveUserController',
            params: 'data: ArchiveUser',
            args: 'data',
            returns: 'Promise<User>',
            usesEntityType: true,
            schema: 'ArchiveUser',
            usesId: false,
            status: 200,
            method: 'post',
            path: '/archive-user',
            failure: 'Failed to archiveUser User',
            custom: true,
        });
    });

    it('no input, void', () => {
        const spec = customAction('User', 'purgeUsers', { withInput: false, returns: 'void' });
        expect(spec.returns).toBe('Promise<void>');
        expect(spec.usesEntityType).toBe(false);
        expect(spec.status).toBe(204);
        expect(spec.method).toBe('get');
    });

    it('with input, void', () => {
        const spec = customAction('User', 'notifyUsers', { withInput: true, returns: 'void' });
        expect(spec.status).toBe(204);
        expect(spec.method).toBe('post');
        expect(spec.schema).toBe('NotifyUsers');
    });

    it('lists the return kinds', () => {
        expect(RETURN_KINDS).toEqual(['list', 'one', 'void']);
    });

    it('lists the methods', () => {
        expect(HTTP_METHODS).toEqual(['get', 'post', 'put', 'patch', 'delete']);
    });
});

describe('customAction on one record', () => {
    it('takes the id, routes under /:id and uses the given method', () => {
        expect(
            customAction('Project', 'archiveProject', { withInput: false, returns: 'one', method: 'patch', onRecord: true })
        ).toEqual({
            name: 'ArchiveProject',
            handler: 'archiveProjectController',
            params: 'id: string',
            args: 'id',
            returns: 'Promise<Project>',
            usesEntityType: true,
            schema: null,
            usesId: true,
            status: 200,
            method: 'patch',
            path: '/:id/archive-project',
            failure: 'Failed to archiveProject Project',
            custom: true,
        });
    });

    it('takes the id before the body with input', () => {
        const spec = customAction('Project', 'renameProject', { withInput: true, returns: 'one', method: 'put', onRecord: true });
        expect(spec.params).toBe('id: string, data: RenameProject');
        expect(spec.args).toBe('id, data');
        expect(spec.schema).toBe('RenameProject');
        expect(spec.method).toBe('put');
    });

    it('defaults to GET on a record without input, as off it', () => {
        const spec = customAction('Project', 'projectHistory', { withInput: false, returns: 'list', onRecord: true });
        expect(spec.method).toBe('get');
        expect(spec.path).toBe('/:id/project-history');
        expect(spec.params).toBe('id: string');
    });

    it('responds 204 for a void delete on a record', () => {
        const spec = customAction('Project', 'purgeProject', { withInput: false, returns: 'void', method: 'delete', onRecord: true });
        expect(spec.status).toBe(204);
        expect(spec.usesEntityType).toBe(false);
    });
});

describe('customAction --method', () => {
    it('keeps the defaults when no method is given', () => {
        expect(customAction('User', 'findActiveUsers', { withInput: false, returns: 'list' }).method).toBe('get');
        expect(customAction('User', 'notifyUsers', { withInput: true, returns: 'void' }).method).toBe('post');
    });

    it('overrides the default method', () => {
        expect(customAction('User', 'purgeUsers', { withInput: false, returns: 'void', method: 'delete' }).method).toBe('delete');
        expect(customAction('User', 'importUsers', { withInput: true, returns: 'list', method: 'put' }).method).toBe('put');
    });

    it('rejects a GET that takes a request body', () => {
        expect(() => customAction('User', 'searchUsers', { withInput: true, returns: 'list', method: 'get' })).toThrow(
            'A GET action cannot take a request body. Drop --with-input, or pick --method post, put, patch, or delete.'
        );
    });
});

describe('customAction status', () => {
    it('responds 201 for a POST that creates and returns a record', () => {
        expect(customAction('Project', 'createProject', { withInput: true, returns: 'one' }).status).toBe(201);
    });

    it('responds 200 for any other POST returning data', () => {
        expect(customAction('User', 'archiveUser', { withInput: true, returns: 'one' }).status).toBe(200);
        expect(customAction('User', 'createdReport', { withInput: true, returns: 'one' }).status).toBe(200);
        expect(customAction('Project', 'createProject', { withInput: true, returns: 'one', method: 'put' }).status).toBe(200);
    });

    it('still responds 204 for a create that returns nothing', () => {
        expect(customAction('Project', 'createProject', { withInput: true, returns: 'void' }).status).toBe(204);
    });
});

describe('customAction in a feature that is the action itself', () => {
    it('routes at the feature root instead of repeating the feature in the path', () => {
        const spec = customAction('Project', 'createProject', { withInput: true, returns: 'one' }, 'create-project');
        expect(spec.path).toBe('/');
        expect(spec.custom).toBe(true);
    });

    it('routes at /:id when the action is on one record', () => {
        const spec = customAction('Project', 'archiveProject', { withInput: false, returns: 'one', method: 'patch', onRecord: true }, 'archive-project');
        expect(spec.path).toBe('/:id');
    });

    it('keeps the slug when the feature is something else', () => {
        expect(customAction('Project', 'createProject', { withInput: true, returns: 'one' }, 'projects').path).toBe('/create-project');
    });
});

describe('isQueryAction', () => {
    it('is true for GET actions that return data', () => {
        expect(isQueryAction(standardAction('List', 'Cat'))).toBe(true);
        expect(isQueryAction(standardAction('Show', 'Cat'))).toBe(true);
        expect(isQueryAction(customAction('Cat', 'findActiveCats', { withInput: false, returns: 'list' }))).toBe(true);
    });

    it('is true for a GET on one record and false for any other method on one', () => {
        expect(isQueryAction(customAction('Cat', 'catHistory', { withInput: false, returns: 'list', onRecord: true }))).toBe(true);
        expect(
            isQueryAction(customAction('Cat', 'archiveCat', { withInput: false, returns: 'one', method: 'patch', onRecord: true }))
        ).toBe(false);
        expect(isQueryAction(customAction('Cat', 'archiveCat', { withInput: false, returns: 'one', method: 'post' }))).toBe(false);
    });

    it('is false for a GET action that returns void', () => {
        expect(isQueryAction(customAction('Cat', 'purgeCats', { withInput: false, returns: 'void' }))).toBe(false);
    });

    it('is false for any non-GET action, regardless of return type', () => {
        expect(isQueryAction(standardAction('Create', 'Cat'))).toBe(false);
        expect(isQueryAction(standardAction('Update', 'Cat'))).toBe(false);
        expect(isQueryAction(standardAction('Delete', 'Cat'))).toBe(false);
        expect(isQueryAction(customAction('Cat', 'archiveCat', { withInput: true, returns: 'one' }))).toBe(false);
    });
});
