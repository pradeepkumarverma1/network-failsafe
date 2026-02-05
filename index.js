const { app, Tray, Menu, ipcMain, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const { autoUpdater } = require("electron-updater");

const network = require('./core/network');
const { loadConfig, saveConfig } = require('./core/config');
const failover = require('./core/failover');
const autoStart = require('./core/autostart');

// index.js (main.js)
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
app.commandLine.appendSwitch('disable-gpu'); // This fixes the libva/DRI errors on Linux
app.commandLine.appendSwitch('log-level', '3'); // Only show fatal errors

let tray = null;
let mainWindow = null;
let isQuitting = false;

const isDev = !app.isPackaged;

const relayLog = (msg) => {
    if (mainWindow) {
        mainWindow.webContents.send('engine-log', {
            timestamp: new Date().toLocaleTimeString(),
            message: msg
        });
    }
};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 950,
        height: 650,
        show: false,
        frame: false,         // Removes the OS window frame
        titleBarStyle: 'hidden', // Ensures controls are hidden on macOS
        webPreferences: {
            preload: path.join(__dirname, 'core', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    // Removes the default Menu bar (File, Edit, etc.)
    mainWindow.setMenu(null);

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, 'ui/dist/index.html'));
    }

    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            mainWindow.hide();
        }
    });
}

function createTray() {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    // Function to generate the tooltip string
    const updateTooltip = () => {
        const status = failover.getStatus();
        const onlineText = status.online ? 'CONNECTED ✅' : 'OFFLINE ❌';
        const netName = status.network || 'None';
        const priority = status.index !== -1 ? `#${status.index + 1}` : 'Unauthorized';

        // Tooltip string (Max 127 characters on Windows)
        const tooltip = `FailSafe: ${onlineText}\nNet: ${netName}\nPriority: ${priority}`;
        tray.setToolTip(tooltip);
    };

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Network Fail-Safe', enabled: false },
        { type: 'separator' },
        { label: 'Open Dashboard', click: () => mainWindow.show() },
        {
            label: 'Restart Engine',
            click: () => {
                failover.stop?.();
                failover.start(relayLog);
            }
        },
        { type: 'separator' },
        { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
    ]);

    tray.setContextMenu(contextMenu);

    // Update tooltip every 5 seconds to match failover check
    setInterval(updateTooltip, 5000);
    updateTooltip(); // Initial call

    tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
}

app.whenReady().then(() => {
    failover.start(relayLog);
    createWindow();
    createTray();

    autoUpdater.checkForUpdatesAndNotify();

    // Optional: Log update progress to your new UI console
    autoUpdater.on('update-available', () => relayLog("New update found! Downloading..."));
    autoUpdater.on('update-downloaded', () => relayLog("Update ready. Restart to apply."));

    if (process.platform === 'darwin') app.dock.hide();
});

/* IPC HANDLERS - The Fix is Here */
ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
});

ipcMain.on('window-hide', () => {
    mainWindow.hide();
});

const handleIpc = (name, fn) => {
    ipcMain.handle(name, async (event, ...args) => {
        try {
            // We pass args spread so the actual data (args[0]) 
            // is what reaches your functions.
            return await fn(...args);
        } catch (err) {
            console.error(`IPC Error [${name}]:`, err);
            throw err;
        }
    });
};

handleIpc('get-profiles', () => network.listProfiles());
handleIpc('get-config', () => loadConfig());
handleIpc('get-status', () => failover.getStatus());
handleIpc('autostart-status', () => autoStart.isAutoStartEnabled());
handleIpc('autostart-enable', () => autoStart.enableAutoStart());
handleIpc('autostart-disable', () => autoStart.disableAutoStart());

// Specific handler for save-config to ensure data integrity
ipcMain.handle('save-config', (event, config) => {
    if (!config) return false;

    // 1. Stop the engine so it doesn't try to switch networks 
    // while we are updating the files.
    failover.stop();

    // 2. Persist the new data
    const current = loadConfig();
    saveConfig({ ...current, ...config });

    // 3. Restart the engine. 
    // Because failover.start() calls loadConfig(), 
    // it will now pull the FRESH priority list from the disk.
    failover.start(relayLog);

    relayLog('[MAIN] Config saved and Failover engine restarted.');
    return true;
});

// In main.js - Update your restart-engine handler
ipcMain.handle('restart-engine', () => {
    failover.stop(); // Use the new stop function
    failover.start(relayLog); // This reloads the config internally
    return true;
});

app.on('window-all-closed', (e) => e.preventDefault());