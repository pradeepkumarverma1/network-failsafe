const { exec } = require('child_process');

/**
 * Execute the OS level commands
 * @param {string} cmd The command to execute
 * @returns Promise
 */
function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

module.exports = { run };
