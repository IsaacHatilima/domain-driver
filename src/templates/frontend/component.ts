export function renderComponent(name: string, directive: boolean): string {
    const header = directive ? "'use client';\n\n" : '';

    return `${header}interface ${name}Props {
  id: string;
}

export default function ${name}({ id }: ${name}Props) {
  return (
    <div>
      <h1>${name} {id}</h1>
    </div>
  );
}
`;
}
