import type * as TsModule from 'typescript';

type Ts = typeof TsModule;

export type ModuleProperty = 'imports' | 'controllers' | 'providers';

export interface RegisterRequest {
    readonly identifier: string;
    readonly importPath: string;
    readonly property: ModuleProperty;
    /** Insert ahead of this identifier when present. Nest matches routes in declaration order. */
    readonly before?: string;
}

export type RegisterResult =
    | { readonly status: 'edited'; readonly source: string }
    | { readonly status: 'already-registered' }
    | { readonly status: 'bailed'; readonly reason: string };

interface Edit {
    readonly at: number;
    readonly text: string;
}

function bail(reason: string): RegisterResult {
    return { status: 'bailed', reason };
}

function parse(ts: Ts, source: string): TsModule.SourceFile {
    return ts.createSourceFile('module.ts', source, ts.ScriptTarget.Latest, true);
}

function moduleArgument(ts: Ts, file: TsModule.SourceFile): TsModule.ObjectLiteralExpression | null {
    for (const statement of file.statements) {
        if (!ts.isClassDeclaration(statement) || !ts.canHaveDecorators(statement)) continue;
        for (const decorator of ts.getDecorators(statement) ?? []) {
            const call = decorator.expression;
            if (!ts.isCallExpression(call)) continue;
            if (!ts.isIdentifier(call.expression) || call.expression.text !== 'Module') continue;
            const [argument] = call.arguments;
            if (argument !== undefined && ts.isObjectLiteralExpression(argument)) return argument;
        }
    }
    return null;
}

function propertyArray(
    ts: Ts,
    object: TsModule.ObjectLiteralExpression,
    name: string
): TsModule.ArrayLiteralExpression | 'missing' | 'not-array' {
    for (const property of object.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = property.name;
        const text = ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : null;
        if (text !== name) continue;
        return ts.isArrayLiteralExpression(property.initializer) ? property.initializer : 'not-array';
    }
    return 'missing';
}

function contains(ts: Ts, array: TsModule.ArrayLiteralExpression, identifier: string): boolean {
    return array.elements.some((element) => ts.isIdentifier(element) && element.text === identifier);
}

function indentAt(source: string, position: number): string {
    const lineStart = source.lastIndexOf('\n', position - 1) + 1;
    return /^[ \t]*/.exec(source.slice(lineStart, position))?.[0] ?? '';
}

function importEdit(ts: Ts, file: TsModule.SourceFile, request: RegisterRequest): Edit {
    const line = `import { ${request.identifier} } from '${request.importPath}';`;
    const imports = file.statements.filter(ts.isImportDeclaration);
    if (imports.length === 0) return { at: 0, text: `${line}\n` };
    return { at: imports[imports.length - 1].end, text: `\n${line}` };
}

function elementEdit(
    ts: Ts,
    source: string,
    file: TsModule.SourceFile,
    array: TsModule.ArrayLiteralExpression,
    request: RegisterRequest
): Edit {
    const identifier = request.identifier;
    if (array.elements.length === 0) {
        return { at: array.end - 1, text: identifier };
    }

    const anchor =
        request.before === undefined
            ? undefined
            : array.elements.find((element) => ts.isIdentifier(element) && element.text === request.before);

    const last = array.elements[array.elements.length - 1];
    const singleLine = !source.slice(array.getStart(file), last.end).includes('\n');

    if (anchor !== undefined) {
        const at = anchor.getStart(file);
        return { at, text: singleLine ? `${identifier}, ` : `${identifier},\n${indentAt(source, at)}` };
    }
    const text = singleLine ? `, ${identifier}` : `,\n${indentAt(source, last.getStart(file))}${identifier}`;
    return { at: last.end, text };
}

function apply(source: string, edits: readonly Edit[]): string {
    return [...edits]
        .sort((a, b) => b.at - a.at)
        .reduce((text, edit) => `${text.slice(0, edit.at)}${edit.text}${text.slice(edit.at)}`, source);
}

/**
 * The edit is only returned if the result both parses cleanly and reads back as registered.
 * A wrong offset produces a file that fails one of those, and the caller keeps the original.
 */
function verify(ts: Ts, source: string, request: RegisterRequest): boolean {
    const syntaxErrors = ts.transpileModule(source, {
        reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.Latest },
    }).diagnostics;
    if ((syntaxErrors ?? []).length > 0) return false;

    const file = parse(ts, source);
    const object = moduleArgument(ts, file);
    if (object === null) return false;
    const array = propertyArray(ts, object, request.property);
    if (array === 'missing' || array === 'not-array') return false;
    return contains(ts, array, request.identifier);
}

export function registerInModule(ts: Ts, source: string, request: RegisterRequest): RegisterResult {
    const file = parse(ts, source);

    const object = moduleArgument(ts, file);
    if (object === null) return bail('no @Module decorator with an object argument was found');

    const array = propertyArray(ts, object, request.property);
    if (array === 'missing') return bail(`the @Module decorator has no "${request.property}" property`);
    if (array === 'not-array') return bail(`"${request.property}" is not an array literal`);

    if (contains(ts, array, request.identifier)) return { status: 'already-registered' };

    const edited = apply(source, [
        importEdit(ts, file, request),
        elementEdit(ts, source, file, array, request),
    ]);

    if (!verify(ts, edited, request)) return bail('the edited file did not read back as valid');
    return { status: 'edited', source: edited };
}
