/**
 * Prints the Contrast_Table: every pair of TOKEN_PAIRS in both themes, with the ratio truncated
 * (never rounded up) to two decimals. A pair below its minimum is flagged and the exit status is 1.
 * Run: node scripts/contrast_report.ts
 */
import { TOKEN_PAIRS, contrastRatio, tokenColour, truncateRatio } from '../src/ui/theme/contrast.ts';
import type { ThemeName } from '../src/ui/theme/contrast.ts';

let below = 0;
for (const theme of ['day', 'night'] as ThemeName[]) {
  console.log(`\n${theme}`);
  for (const pair of TOKEN_PAIRS.filter((candidate) => candidate.theme === theme)) {
    const foreground = tokenColour(theme, pair.foreground);
    const background = tokenColour(theme, pair.background);
    const ratio = contrastRatio(foreground, background);
    const fails = ratio < pair.minimum;
    if (fails) below += 1;
    console.log(
      `${fails ? 'BELOW' : 'ok   '} ${pair.foreground} ${foreground} on ${pair.background}${pair.background === 'frost' || pair.background === 'hero' || pair.background === 'night-photo' ? ' (worst case)' : ''} ${background}: ${truncateRatio(ratio)} (minimum ${pair.minimum})`,
    );
  }
}
console.log(below === 0 ? '\nEvery pair meets its minimum.' : `\n${below} pair(s) below the minimum.`);
process.exit(below === 0 ? 0 : 1);
