import { lowerFirst, toPascalCase } from '../../utils/naming';

export function keysConstant(feature: string): string {
    return `${lowerFirst(toPascalCase(feature))}Keys`;
}

export function renderQueryKeys(feature: string): string {
    return `export const ${keysConstant(feature)} = {
  all: ['${feature}'] as const,
  detail: (id: string) => ['${feature}', id] as const,
};
`;
}
