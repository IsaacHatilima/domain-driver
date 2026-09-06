export const START = '<!-- domain-driver:start -->';
export const END = '<!-- domain-driver:end -->';

export type SectionStatus = 'created' | 'updated' | 'unchanged';

export interface SectionResult {
    readonly content: string;
    readonly status: SectionStatus;
}

export function applySection(existing: string | null, section: string): SectionResult {
    if (existing === null) {
        return { content: `${section}\n`, status: 'created' };
    }

    const start = existing.indexOf(START);
    const end = existing.indexOf(END);

    if (start !== -1 && end !== -1 && end > start) {
        const before = existing.slice(0, start);
        const after = existing.slice(end + END.length);
        const content = `${before}${section}${after}`;
        return { content, status: content === existing ? 'unchanged' : 'updated' };
    }

    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    return { content: `${existing}${separator}${section}\n`, status: 'updated' };
}
