export const ACTIONS = ['List', 'Show', 'Create', 'Update', 'Delete'] as const;
export type Action = (typeof ACTIONS)[number];

export const WRITE_ACTIONS = ['Create', 'Update'] as const;
export type WriteAction = (typeof WRITE_ACTIONS)[number];
