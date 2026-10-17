import { execFileSync } from 'node:child_process';

export function resolveBuildIdentity(cwd: string) {
  // Fail the build if its source revision cannot be established; never substitute a manual label.
  const buildSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40,64}$/i.test(buildSha)) throw new Error('Cannot resolve build Git SHA');
  const buildDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).trim());
  const builtAt = new Date().toISOString();
  return { buildSha, buildDirty, builtAt, buildId: `${buildSha}-${builtAt}${buildDirty ? '-dirty' : ''}` };
}
