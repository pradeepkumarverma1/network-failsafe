const { run } = require('./exec');
const { isWindows } = require('./platform');

const targets = ['1.1.1.1', '8.8.8.8'];

async function hasInternet() {
  for (const ip of targets) {
    const cmd = isWindows
      ? `ping -n 1 -w 1000 ${ip}`
      : `ping -c 1 -W 1 ${ip}`;

    try {
      await run(cmd);
      return true; // ANY success = internet is up
    } catch (err) {
      // silently try next target
    }
  }

  return false; // all failed
}

module.exports = { hasInternet };
