/** SHA-256 baselines from the published 0.8.0 installer, never local project guesses. */
export const LEGACY_SKILL_HASHES: Readonly<Record<string, string>> = Object.freeze({
    '.claude/skills/domain-driver/SKILL.md': 'f34c1f3b444dc552dec5b525befbff26f36d626961c92f28ad0424459a65d079',
    '.claude/skills/domain-factory/SKILL.md': 'a9c11ce90fc6f8244ff822e3c81ff6a7352f116ee467e818ff04b4276f1cedc5',
    '.agents/skills/domain-factory/SKILL.md': 'a9c11ce90fc6f8244ff822e3c81ff6a7352f116ee467e818ff04b4276f1cedc5',
    '.agents/skills/domain-factory/agents/openai.yaml': '0ee1e7a5b0e54ae8adc0d61d610e393ab63219069bf87ea4aeb8555c9151aff4',
});

export const LEGACY_SKILL_DIRECTORIES = Object.freeze([
    '.claude/skills/domain-driver',
    '.claude/skills/domain-factory',
    '.agents/skills/domain-factory',
]);
