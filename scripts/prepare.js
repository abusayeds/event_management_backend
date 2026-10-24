// Installs husky's git hooks for local development only. Nothing here may fail a
// build: Docker, CI and production installs all run `prepare` after `npm ci`, and
// those images have no .git folder and (with --omit=dev) no husky. Node built-ins
// only, so the script works before any dependency is resolvable.
const fs = require('fs');
const path = require('path');

const skip =
  process.env.HUSKY === '0' ||
  Boolean(process.env.CI) ||
  process.env.NODE_ENV === 'production' ||
  !fs.existsSync(path.join(__dirname, '..', '.git'));

if (!skip) {
  try {
    // husky is a devDependency, so this throws in a production-only tree.
    const husky = require('husky');
    const install = typeof husky === 'function' ? husky : husky && husky.default;
    if (typeof install === 'function') install();
  } catch {
    // No husky, no hooks — that is a normal install, not a failure.
  }
}

process.exit(0);
