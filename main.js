const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit',
  });
}

let mainWindow;
let pty;
let ptyProcess;

// 設定ファイル
const CONFIG_PATH = path.join(os.homedir(), '.claude-terminal-config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 700,
    minHeight: 450,
    backgroundColor: '#0a0e17',
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => {
    if (ptyProcess) ptyProcess.kill();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 設定取得
ipcMain.handle('get-config', async () => loadConfig());

// 設定保存
ipcMain.handle('save-config', async (event, partial) => {
  const config = loadConfig();
  Object.assign(config, partial);
  saveConfig(config);
  return config;
});

// 作業ディレクトリ選択ダイアログ
ipcMain.handle('select-directory', async () => {
  const config = loadConfig();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '作業ディレクトリを選択',
    defaultPath: config.workDir || (process.env.HOME || process.env.USERPROFILE),
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const dir = result.filePaths[0];
    config.workDir = dir;
    saveConfig(config);
    return dir;
  }
  return null;
});

// PTY 起動
ipcMain.handle('start-pty', async (event, options = {}) => {
  try {
    pty = require('node-pty');
  } catch (e) {
    return { error: 'node-ptyが見つかりません: ' + e.message };
  }

  const config = loadConfig();
  const shell = process.platform === 'win32' ? 'cmd.exe' : (process.env.SHELL || '/bin/bash');
  const cols = options.cols || 120;
  const rows = options.rows || 30;
  const cwd = config.workDir || process.env.HOME || process.env.USERPROFILE;

  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' };
  delete env.CLAUDECODE;

  try {
    ptyProcess = pty.spawn(shell, [], { name: 'xterm-256color', cols, rows, cwd, env });
  } catch (e) {
    return { error: 'PTY起動に失敗しました: ' + e.message };
  }

  ptyProcess.onData((data) => {
    if (mainWindow) mainWindow.webContents.send('pty-data', data);
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (mainWindow) mainWindow.webContents.send('pty-exit', exitCode);
  });

  return { success: true, cwd };
});

// PTY 書き込み
ipcMain.on('pty-write', (event, data) => {
  if (ptyProcess) ptyProcess.write(data);
});

// PTY リサイズ
ipcMain.on('pty-resize', (event, { cols, rows }) => {
  if (ptyProcess) { try { ptyProcess.resize(cols, rows); } catch (e) {} }
});

// ウィンドウタイトル更新
ipcMain.on('set-title', (event, title) => {
  if (mainWindow) mainWindow.setTitle(title);
});
