const { run } = require('./exec');
const isWindows = process.platform === 'win32';

async function listProfiles() {
  try {
    if (!isWindows) {
      const out = await run('nmcli -t -f NAME connection show');
      return out.split('\n')
        .map(line => line.trim())
        .filter(line => line && line !== 'lo' && !line.includes('virbr') && !line.includes('docker'));
    } else {
      const out = await run('netsh wlan show profiles');
      return out.split('\n')
        .filter(line => line.includes(':'))
        .map(line => line.split(':')[1].trim())
        .filter(name => name !== "");
    }
  } catch (err) { return []; }
}

async function getActiveNetwork() {
  try {
    if (!isWindows) {
      const out = await run('nmcli -t -f NAME,STATE connection show --active');
      const lines = out.split('\n').filter(Boolean);
      const activeLine = lines.find(l => l.includes(':activated'));
      return activeLine ? activeLine.split(':')[0].trim() : null;
    } else {
      const out = await run('netsh wlan show interfaces');
      const match = out.match(/^\s*Profile\s*:\s*(.+)$/m);
      return match ? match[1].trim() : null;
    }
  } catch { return null; }
}

async function isProfileAvailable(name) {
  try {
    if (!isWindows) {
      // We scan for SSIDs currently in the air
      const out = await run('nmcli -t -f SSID dev wifi');
      const ssidsInAir = out.split('\n').map(s => s.trim());
      return ssidsInAir.includes(name);
    } else {
      const out = await run('netsh wlan show networks');
      return out.includes(name);
    }
  } catch { return false; }
}

async function connect(name) {
  const cmd = !isWindows 
    ? `nmcli device wifi connect "${name}"` 
    : `netsh wlan connect name="${name}"`;
  
  const out = await run(cmd);
  if (out.toLowerCase().includes('error') || out.toLowerCase().includes('failed')) {
    throw new Error(out);
  }
  return true;
}

module.exports = { listProfiles, getActiveNetwork, isProfileAvailable, connect };