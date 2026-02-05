// core/autostart.js
const { app } = require('electron');
const path = require('path');

function enableAutoStart() {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe'),
    args: []
  });
}

function disableAutoStart() {
  app.setLoginItemSettings({
    openAtLogin: false
  });
}

function isAutoStartEnabled() {
  return app.getLoginItemSettings().openAtLogin;
}

module.exports = {
  enableAutoStart,
  disableAutoStart,
  isAutoStartEnabled
};
