const { execSync } = require('child_process');

const skipHusky =
  process.env.HUSKY === '0' ||
  process.env.CI === '1' ||
  process.env.CI === 'true' ||
  process.env.NODE_ENV === 'production';

if (skipHusky) {
  process.exit(0);
}

try {
  execSync('husky', { stdio: 'inherit' });
} catch {
  process.exit(0);
}
