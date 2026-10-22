/**
 * Runs `prisma generate` with stdin ignored.
 * Avoids `setRawMode EIO` crashes in tmux/SSH/nested npm scripts
 * where Prisma's Ink TUI tries to take over a broken TTY.
 */
const { spawnSync } = require('child_process');
const path = require('path');

// Resolve Prisma's JS entrypoint and run it with node directly. Going through
// the .bin shim would need `shell: true` on Windows, which breaks on paths
// containing spaces.
const prismaCli = path.join(
  path.dirname(require.resolve('prisma/package.json')),
  require('prisma/package.json').bin.prisma
);

const result = spawnSync(process.execPath, [prismaCli, 'generate'], {
  env: {
    ...process.env,
    CI: '1',
    FORCE_COLOR: '0',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
