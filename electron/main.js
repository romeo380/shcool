const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Read config from main.json
let config = {};
try {
  const configPath = path.join(__dirname, '../main.json');
  const configFile = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(configFile);
} catch (error) {
  console.error("Could not load or parse main.json. Using defaults.", error);
  // Default values in case file doesn't exist or is invalid
  config.window = {
    width: 1280,
    height: 800,
    title: 'School Election Voting System'
  };
}

const windowConfig = config.window || {};


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: windowConfig.width || 1280,
    height: windowConfig.height || 800,
    title: windowConfig.title || 'School Election Voting System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // Load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools if needed for debugging.
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  // On macOS, applications and their menu bar stay active until the user quits
  // explicitly with Cmd + Q. On other platforms, we quit.
  if (process.platform !== 'darwin') app.quit();
});
