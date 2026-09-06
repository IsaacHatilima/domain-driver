import { describe, it, expect } from 'vitest';
import { actionCase, customAction, standardAction, standardActions, RETURN_KINDS } from '../actions';

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
});
