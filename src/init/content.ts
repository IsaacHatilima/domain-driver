import { END, START } from './markers';

/** Only the marker-managed pointer lives here; all skill content comes from the shared library. */
export const AGENTS_SECTION: string = [
    START,
    '## Scaffolding with domain-driver',
    '',
    'Use the domain-driver CLI to scaffold feature folders before filling in their implementation.',
    'Read `.agents/skills/javascript-domain-driver/SKILL.md` (or the matching `.claude/skills/` copy) for commands and stack detection.',
    'For a complete feature workflow, explicitly invoke `/factory <request>` in Claude Code or `$factory <request>` in Codex.',
    'Shared capabilities are indexed in `.agents/skills/catalog.md`. Re-run `npx domain-driver init` after upgrading to refresh them.',
    END,
].join('\n');
