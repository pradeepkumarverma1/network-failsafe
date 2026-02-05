const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const defaultConfig = {
  priorityList: [],
  checkInterval: 3000,
  failThreshold: 3,
  recoverThreshold: 2
};

function getConfigPath() {
  // If app isn't ready, fallback to current working directory to prevent crash
  const userDataPath = app.isReady() ? app.getPath('userData') : process.cwd();
  const configFilePath = path.join(userDataPath, 'config.json');
  return { dir: userDataPath, file: configFilePath };
}

function loadConfig() {
  const { dir, file } = getConfigPath();
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return { ...defaultConfig, ...data };
  } catch (err) {
    console.error("Config load error:", err);
    return defaultConfig;
  }
}

function saveConfig(config) {
  const { file } = getConfigPath();
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
}

module.exports = { loadConfig, saveConfig };