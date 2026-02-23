// ===== エイリアス定義 =====
const ALIASES = [
  { key: 'cc',             cmd: 'claude',                                    desc: 'Claude Code 起動' },
  { key: 'cc-c',           cmd: 'claude --continue',                         desc: '前のセッションを継続' },
  { key: 'cc-r',           cmd: 'claude --resume',                           desc: 'セッション選択して再開' },
  { key: 'cc-p',           cmd: 'claude --print',                            desc: 'プリントモード' },
  { key: 'cc-v',           cmd: 'claude --version',                          desc: 'バージョン確認' },
  { key: 'cc-h',           cmd: 'claude --help',                             desc: 'ヘルプ表示' },
  { key: 'cc-debug',       cmd: 'claude --debug',                            desc: 'デバッグモード' },
  { key: 'cc-dangerously', cmd: 'claude --dangerously-skip-permissions',     desc: '権限スキップ (注意)' },
  { key: 'git-s',          cmd: 'git status',                                desc: 'Git ステータス' },
  { key: 'git-log',        cmd: 'git log --oneline -10',                     desc: 'Git ログ 10件' },
  { key: 'll',             cmd: 'ls -la',                                    desc: 'ファイル一覧' },
  { key: 'cls',            cmd: 'clear',                                     desc: '画面クリア' },
];

// ===== 入力履歴 =====
const inputHistory = [];
let historyIndex = -1;
let savedInput = '';

// ===== xterm.js 初期化 =====
const term = new Terminal({
  theme: {
    background:          '#0a0e17',
    foreground:          '#c9d1d9',
    cursor:              '#cc785c',
    cursorAccent:        '#0a0e17',
    selectionBackground: 'rgba(88,166,255,0.25)',
    black:   '#0d1117', red:     '#f85149', green:   '#3fb950', yellow:  '#d29922',
    blue:    '#58a6ff', magenta: '#bc8cff', cyan:    '#39c5cf', white:   '#b1bac4',
    brightBlack:   '#6e7681', brightRed:     '#ff7b72', brightGreen:   '#56d364',
    brightYellow:  '#e3b341', brightBlue:    '#79c0ff', brightMagenta: '#d2a8ff',
    brightCyan:    '#56d4dd', brightWhite:   '#f0f6fc',
  },
  fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
  fontSize: 13,
  lineHeight: 1.4,
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 5000,
  allowProposedApi: true,
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal'));

setTimeout(() => { fitAddon.fit(); updateSizeDisplay(); }, 100);

// 右クリックで選択テキストをコピー
term.element.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const selection = term.getSelection();
  if (selection) {
    navigator.clipboard.writeText(selection);
    showToast('コピーしました');
  }
});

window.addEventListener('resize', () => {
  fitAddon.fit();
  updateSizeDisplay();
  window.electronAPI.resizePty({ cols: term.cols, rows: term.rows });
});

function updateSizeDisplay() {
  document.getElementById('sb-size').textContent = `${term.cols}x${term.rows}`;
}

// ===== PTY 起動 =====
async function startPty() {
  setStatus('接続中...');
  fitAddon.fit(); // 正確なサイズを事前に取得
  const result = await window.electronAPI.startPty({ cols: term.cols, rows: term.rows });

  if (result.error) {
    term.writeln('\x1b[31mエラー: ' + result.error + '\x1b[0m');
    setStatus('エラー');
    return;
  }

  setStatus('接続済み');
  updateCwdDisplay(result.cwd);

  term.writeln('\x1b[38;5;202m╔══════════════════════════════════════════╗\x1b[0m');
  term.writeln('\x1b[38;5;202m║        Claude Terminal  v1.1             ║\x1b[0m');
  term.writeln('\x1b[38;5;202m║  Enter=改行  Ctrl+Enter=送信  ↑↓=履歴  ║\x1b[0m');
  term.writeln('\x1b[38;5;202m╚══════════════════════════════════════════╝\x1b[0m');
  term.writeln('');

  // PTY起動後に正確なサイズで再設定
  setTimeout(() => {
    fitAddon.fit();
    window.electronAPI.resizePty({ cols: term.cols, rows: term.rows });
    updateSizeDisplay();
  }, 300);

  window.electronAPI.onPtyData((data) => { term.write(data); });
  window.electronAPI.onPtyExit((code) => {
    term.writeln(`\r\n\x1b[33m[プロセス終了 (exit: ${code})]\x1b[0m`);
    setStatus('切断');
    });
}

// ===== コマンド送信 =====
function sendToTerminal(text) {
  if (!text) return;
  // エイリアス解決（単一行のシンプルな入力のみ）
  const trimmed = text.trim();
  const alias = ALIASES.find(a => a.key === trimmed);
  const resolved = alias ? alias.cmd : text;

  // 履歴追加
  if (inputHistory[0] !== resolved) {
    inputHistory.unshift(resolved);
    if (inputHistory.length > 200) inputHistory.pop();
  }
  historyIndex = -1;
  savedInput = '';

  // PTYに送信（テキストを先に送り、少し後にEnterを送る）
  window.electronAPI.writePty(resolved);
  setTimeout(() => window.electronAPI.writePty('\r'), 30);
}

// ===== 入力エリア =====
const cmdInput = document.getElementById('cmd-input');
const sendBtn  = document.getElementById('send-btn');

// xtermクリック時にinput-areaをdim、テキストエリアフォーカスで戻す
term.element.addEventListener('mousedown', () => {
  document.getElementById('input-area').classList.add('dimmed');
});
cmdInput.addEventListener('focus', () => {
  document.getElementById('input-area').classList.remove('dimmed');
});

// 高さ自動調整
function autoResize() {
  cmdInput.style.height = 'auto';
  cmdInput.style.height = Math.min(cmdInput.scrollHeight, 200) + 'px';
}
cmdInput.addEventListener('input', autoResize);

// キーイベント
cmdInput.addEventListener('keydown', (e) => {

  // Shift+Enter → 改行
  if (e.key === 'Enter' && e.shiftKey) {
    // デフォルト動作（改行）
    return;
  }

  // Enter / Ctrl+Enter → 送信
  if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    const val = cmdInput.value;
    if (val.trim() !== '') {
      sendToTerminal(val);
      cmdInput.value = '';
      cmdInput.style.height = '';
    } else {
      // 空のときはEnterのみ送信（Claude選択UIの確定など）
      window.electronAPI.writePty('\r');
    }
    return;
  }

  // ↑ → 履歴を遡る（改行なし単一行のとき）
  if (e.key === 'ArrowUp' && !cmdInput.value.includes('\n')) {
    e.preventDefault();
    if (historyIndex < inputHistory.length - 1) {
      if (historyIndex === -1) savedInput = cmdInput.value;
      historyIndex++;
      cmdInput.value = inputHistory[historyIndex];
      autoResize();
      setTimeout(() => { cmdInput.selectionStart = cmdInput.selectionEnd = cmdInput.value.length; }, 0);
    }
    return;
  }

  // ↓ → 履歴を進める
  if (e.key === 'ArrowDown' && !cmdInput.value.includes('\n')) {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      cmdInput.value = inputHistory[historyIndex];
    } else if (historyIndex === 0) {
      historyIndex = -1;
      cmdInput.value = savedInput;
    }
    autoResize();
    setTimeout(() => { cmdInput.selectionStart = cmdInput.selectionEnd = cmdInput.value.length; }, 0);
    return;
  }

  // Ctrl+C → 中断
  if (e.ctrlKey && e.key === 'c') {
    e.preventDefault();
    window.electronAPI.writePty('\x03');
    cmdInput.value = '';
    cmdInput.style.height = '';
    return;
  }

  // Ctrl+L → クリア
  if (e.ctrlKey && e.key === 'l') {
    e.preventDefault();
    window.electronAPI.writePty('clear\r');
    return;
  }

  // Tab → 補完
  if (e.key === 'Tab') {
    e.preventDefault();
    window.electronAPI.writePty('\t');
    return;
  }
});

// 送信ボタン
sendBtn.addEventListener('click', () => {
  const val = cmdInput.value;
  if (val.trim() !== '') {
    sendToTerminal(val);
    cmdInput.value = '';
    cmdInput.style.height = '';
  }
  cmdInput.focus();
});

// ===== ツールバーボタン =====
function setCmd(cmd) {
  cmdInput.value = cmd;
  autoResize();
  cmdInput.focus();
  cmdInput.selectionStart = cmdInput.selectionEnd = cmd.length;
}

let autoApprove = false;

function updateAutoApproveBtn() {
  const btn = document.getElementById('btn-auto-approve');
  btn.textContent = `自動許可: ${autoApprove ? 'ON' : 'OFF'}`;
  btn.className = autoApprove ? 'tb-btn accent' : 'tb-btn';
}

document.getElementById('btn-auto-approve').addEventListener('click', async () => {
  autoApprove = !autoApprove;
  await window.electronAPI.saveConfig({ autoApprove });
  updateAutoApproveBtn();
});

document.getElementById('btn-claude').addEventListener('click', () => {
  const cmd = autoApprove ? 'claude --dangerously-skip-permissions' : 'claude';
  window.electronAPI.writePty(cmd);
  setTimeout(() => window.electronAPI.writePty('\r'), 30);
  cmdInput.focus();
});
document.getElementById('btn-clear').addEventListener('click', () => {
  term.clear();
  cmdInput.focus();
});
document.getElementById('btn-ctrlc').addEventListener('click', () => {
  window.electronAPI.writePty('\x03');
  cmdInput.focus();
});

// ===== 作業ディレクトリ選択 =====
document.getElementById('btn-workdir').addEventListener('click', async () => {
  const dir = await window.electronAPI.selectDirectory();
  if (dir) {
    updateCwdDisplay(dir);
    showToast('次回起動時から適用: ' + dir);
    // 即座にcdも実行（Windowsはドライブ間移動のため /d オプションが必要）
    const cdCmd = window.electronAPI.platform === 'win32' ? `cd /d "${dir}"` : `cd "${dir}"`;
    window.electronAPI.writePty(cdCmd + '\r');
  }
});

// ===== エイリアスセレクト =====
const aliasSelect = document.getElementById('alias-select');
ALIASES.forEach(a => {
  const opt = document.createElement('option');
  opt.value = a.key;
  opt.textContent = `${a.key}  →  ${a.desc}`;
  aliasSelect.appendChild(opt);
});
aliasSelect.addEventListener('change', () => {
  const val = aliasSelect.value;
  if (!val) return;
  const alias = ALIASES.find(a => a.key === val);
  if (alias) {
    cmdInput.value = alias.cmd;
    autoResize();
    cmdInput.focus();
    cmdInput.selectionStart = cmdInput.selectionEnd = cmdInput.value.length;
  }
  aliasSelect.value = '';
});

// ===== 表示更新 =====
function updateCwdDisplay(dir) {
  if (!dir) return;
  const el = document.getElementById('sb-cwd');
  if (el) el.textContent = dir;
  const btn = document.getElementById('btn-workdir');
  if (btn) btn.title = '現在: ' + dir;
}

function setStatus(s) {
  document.getElementById('sb-status').textContent = s;
}

function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ===== ドラッグ&ドロップ =====
function insertFilePaths(files) {
  if (files.length === 0) return;
  const paths = Array.from(files).map(f => f.path.includes(' ') ? `"${f.path}"` : f.path).join(' ');
  const start = cmdInput.selectionStart ?? cmdInput.value.length;
  const end = cmdInput.selectionEnd ?? cmdInput.value.length;
  cmdInput.value = cmdInput.value.slice(0, start) + paths + cmdInput.value.slice(end);
  cmdInput.selectionStart = cmdInput.selectionEnd = start + paths.length;
  autoResize();
  cmdInput.focus();
}

[document.getElementById('input-area'), document.getElementById('terminal-container')].forEach(el => {
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drag-over');
    insertFilePaths(e.dataTransfer.files);
  });
});

// ===== 起動 =====
(async () => {
  // 保存済み設定を読み込む
  const config = await window.electronAPI.getConfig();
  if (config.workDir) updateCwdDisplay(config.workDir);
  if (config.autoApprove) { autoApprove = true; updateAutoApproveBtn(); }

  await startPty();
  cmdInput.focus();
})();
