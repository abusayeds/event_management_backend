const { execSync } = require('child_process');
const dotenv = require('dotenv');

dotenv.config({ quiet: true });

const port = Number(process.env.PORT || 8054);

if (!Number.isInteger(port) || port <= 0) {
  console.warn(`[predev] Invalid PORT value: ${process.env.PORT}`);
  process.exit(0);
}

const run = command => execSync(command, { stdio: 'pipe' }).toString().trim();

try {
  if (process.platform === 'win32') {
    const command = `powershell -NoProfile -Command "$connections=Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue; if($connections){$connections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Output \"[predev] Killed PID $_ on port ${port}\" }} else { Write-Output \"[predev] No process is using port ${port}\" }"`;
    run(command);
    console.log(`[predev] Port ${port} is ready`);
  } else {
    const pids = run(`lsof -ti tcp:${port} || true`);
    if (!pids) {
      console.log(`[predev] Port ${port} is ready`);
      process.exit(0);
    }

    run(`kill -9 ${pids.split('\n').join(' ')}`);
    console.log(`[predev] Port ${port} is ready`);
  }
} catch (error) {
  console.warn(`[predev] Could not ensure free port ${port}: ${error.message}`);
}
