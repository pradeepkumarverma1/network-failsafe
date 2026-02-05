// core/notify.js
const { Notification } = require('electron');

function notify(title, body) {
  new Notification({ title, body, silent: true }).show();
}

module.exports = { notify };
