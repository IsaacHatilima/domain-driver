/**
 * Parses JSON with comments and trailing commas, the dialect tsconfig.json is written in.
 *
 * A scanner rather than regexes, because comment markers are ordinary characters inside strings:
 * the default Next tsconfig has `"@/*"` and `"**\/*.ts"`, and stripping `/* ... *\/` without
 * knowing about strings deletes everything between them. A `$schema` URL's `//` is the same trap.
 */
export function parseJsonc(text: string): unknown {
    return JSON.parse(stripTrailingCommas(stripComments(text)));
}

/** Index just past the closing quote of the string that opens at `start`. */
function stringEnd(text: string, start: number): number {
    let index = start + 1;
    while (index < text.length) {
        if (text[index] === '\\') index += 2;
        else if (text[index] === '"') return index + 1;
        else index += 1;
    }
    // Unterminated: hand it on unchanged and let JSON.parse report it.
    return text.length;
}

function stripComments(text: string): string {
    const kept: string[] = [];
    let index = 0;
    while (index < text.length) {
        const char = text[index];
        const next = text[index + 1];
        if (char === '"') {
            const end = stringEnd(text, index);
            kept.push(text.slice(index, end));
            index = end;
        } else if (char === '/' && next === '/') {
            const newline = text.indexOf('\n', index);
            index = newline === -1 ? text.length : newline;
        } else if (char === '/' && next === '*') {
            const close = text.indexOf('*/', index + 2);
            if (close === -1) throw new Error('Unterminated block comment');
            kept.push(' ');
            index = close + 2;
        } else {
            kept.push(char);
            index += 1;
        }
    }
    return kept.join('');
}

function closesNext(text: string, from: number): boolean {
    let index = from;
    while (index < text.length && /\s/.test(text[index])) index += 1;
    return text[index] === '}' || text[index] === ']';
}

function stripTrailingCommas(text: string): string {
    const kept: string[] = [];
    let index = 0;
    while (index < text.length) {
        const char = text[index];
        if (char === '"') {
            const end = stringEnd(text, index);
            kept.push(text.slice(index, end));
            index = end;
            continue;
        }
        if (!(char === ',' && closesNext(text, index + 1))) kept.push(char);
        index += 1;
    }
    return kept.join('');
}
