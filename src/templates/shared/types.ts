export function renderTypes(entity: string): string {
    return `export interface ${entity} {
  id: string;
  // add ${entity} fields here
  createdAt: string;
  updatedAt: string;
}
`;
}
