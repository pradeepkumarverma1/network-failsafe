const { loadConfig } = require('./config');
const { hasInternet } = require('./hasInternet');
const network = require('./network');
const { notify } = require('./notify'); // Destructured to match your notify.js export

let config = null;
let switching = false;
let intervalId = null;
let failCount = 0;
let successCount = 0;

let status = {
  state: 'INIT',
  online: null,
  network: null,
  index: -1
};

let logCallback = null; // Store the function here

// Helper to safely trigger the callback
function sendToUI(msg) {
  console.log(`[STATUS] ${msg}`); // Keep terminal logs
  if (logCallback) logCallback(msg);
}

/**
 * Returns a copy of the current engine status for the UI
 */
function getStatus() {
  return { ...status };
}

/**
 * Orchestrates the connection attempt and notification flow
 */
async function tryConnect(index) {
  const name = config.priorityList[index];
  if (!name || switching) return false;

  try {
    switching = true;
    status.state = 'SWITCHING';

    // Notify user of the intent
    notify('Network Switch', `Attempting to connect to: ${name}`);

    const success = await network.connect(name);

    if (success) {
      status.network = name;
      status.index = index;
      notify('Connected', `Successfully switched to ${name}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[STATUS] Connection Error: ${err.message}`);
    return false;
  } finally {
    switching = false;
    status.state = 'RUNNING';
  }
}

/**
 * The main logic loop
 */
async function tick() {
  // Safety check: Don't run if config is missing or we are already in the middle of a switch
  if (!config?.priorityList?.length || switching) return;

  const online = await hasInternet().catch(() => false);
  const activeNow = await network.getActiveNetwork();
  const actualIndex = config.priorityList.indexOf(activeNow);

  // Update internal status for the UI bridge
  status.online = online;
  status.network = activeNow;
  status.index = actualIndex;

  // --- CASE 1: OFFLINE OR ON UNAUTHORIZED NETWORK ---
  // If internet is dead OR the network we are on isn't in our priority list
  if (!online || actualIndex === -1) {
    status.state = 'SCANNING';
    sendToUI(`[STATUS] Issue detected (Online: ${online}, Index: ${actualIndex}). Scanning...`);

    for (let i = 0; i < config.priorityList.length; i++) {
      const target = config.priorityList[i];

      // Optimization: If we are technically "online" but on a non-list network,
      // don't try to reconnect to the one we are already on.
      // NEW CHECK: Skip if it's the current network AND it's the one failing internet
      // This stops the "Command failed" loops on the same active-but-dead network
      if (i === actualIndex) {
        sendToUI(`[STATUS] Skipping ${target} (already connected but no internet).`);
        continue;
      }

      const isAvailable = await network.isProfileAvailable(target);
      if (isAvailable) {
        const success = await tryConnect(i);
        if (success) {
          failCount = 0;
          successCount = 0;
          return; // Exit tick once successful
        }
      }
    }

    // Send a single notification if we are completely stranded
    if (!online && failCount === 0) {
      notify('Connection Lost', 'No authorized backup networks found in range.', 'critical');
      failCount = 1; // Mark as notified
    }
  }
  // --- CASE 2: ONLINE BUT CHECKING FOR BETTER PRIORITY (RECOVERY) ---
  else if (online && actualIndex > 0) {
    status.state = 'RUNNING';
    successCount++;

    // Only try to upgrade if we have been stable for the required threshold
    if (successCount >= (config.recoverThreshold || 5)) {
      sendToUI(`[STATUS] Checking if higher priority networks are back in range...`);

      for (let i = 0; i < actualIndex; i++) {
        const betterNet = config.priorityList[i];
        if (await network.isProfileAvailable(betterNet)) {
          const success = await tryConnect(i);
          if (success) {
            successCount = 0;
            return;
          }
        }
      }
      // If we checked and found nothing better, reset count so we don't scan every single tick
      successCount = 0;
    }
  }
  // --- CASE 3: ALL GOOD (ON PRIORITY #1 AND ONLINE) ---
  else {
    status.state = 'RUNNING';
    failCount = 0;
    // We don't reset successCount here to let it stay ready if we were to fall to index 1 later
  }
}

/**
 * Initializes and starts the engine
 */
function start(logger) {
  stop(); // Ensure clean slate

  if (logger) {
    logCallback = logger;
  }

  config = loadConfig();

  // On start, we want an immediate evaluation of high priority
  successCount = config.recoverThreshold || 5;
  failCount = 0;

  if (!config || !config.priorityList || config.priorityList.length === 0) {
    status.state = 'NO_CONFIG';
    sendToUI('[STATUS] Engine started but no priority list is configured.');
    return;
  }

  status.state = 'RUNNING';
  sendToUI('[STATUS] Engine started.');

  // Execute first tick immediately
  tick();

  // Set periodic interval
  intervalId = setInterval(tick, config.checkInterval || 5000);
}

/**
 * Stops the engine
 */
function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  status.state = 'STOPPED';
  sendToUI('[STATUS] Engine stopped.');
}

module.exports = {
  start,
  stop,
  getStatus
};