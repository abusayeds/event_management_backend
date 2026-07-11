/**
 * Runs `prisma generate` with stdin ignored.
 * Avoids `setRawMode EIO` crashes in tmux/SSH/nested npm scripts
 * where Prisma's Ink TUI tries to take over a broken TTY.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const prismaBin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);

const result = spawnSync(prismaBin, ['generate'], {
  env: {
    ...process.env,
    CI: '1',
    FORCE_COLOR: '0',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
