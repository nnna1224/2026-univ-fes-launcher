// 学祭ゲームランチャー本体。Astroで生成したサイト(dist)をそのまま表示し、
// manifest に登録されたゲームをダウンロード・展開・起動する。
const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const { spawn, execFile } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const appRoot = path.join(__dirname, '..');
const siteRoot = path.join(appRoot, 'dist');

// ゲームやキャッシュを1フォルダにまとめ、このフォルダを消せば元に戻せるようにする。
// 大きなゲームが移動プロファイルで同期されないよう Roaming ではなく Local に置き、
// 開発時と配布版で場所が変わらないよう名前は appId で固定する。
app.setPath('userData', path.join(process.env.LOCALAPPDATA ?? app.getPath('appData'), 'jp.g2.festival-game-launcher'));
const gamesRoot = () => path.join(app.getPath('userData'), 'games');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

/** dist を 127.0.0.1 で配信する。YouTube埋め込みが file:// では動かないため http を使う。 */
function startSiteServer() {
  const server = http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = path.join(siteRoot, pathname);
      if (!file.startsWith(siteRoot + path.sep)) throw new Error('outside');
      const body = await fsp.readFile(file);
      res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not Found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

// manifest のURL（GitHubのプライベートリポジトリならトークンも）はexeに含めず、初回起動時に入力してもらう。
// 設定と manifest のキャッシュ（zipのURLを含む）は、safeStorage（WindowsではDPAPI）で
// このPCのユーザーだけが復号できる形に暗号化して保存する。
const settingsPath = () => path.join(app.getPath('userData'), 'settings.bin');
const manifestCachePath = () => path.join(app.getPath('userData'), 'manifest.cache.bin');

function readEncrypted(file) {
  try {
    return safeStorage.decryptString(fs.readFileSync(file));
  } catch {
    return undefined;
  }
}

function writeEncrypted(file, text) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('このPCでは暗号化して保存できません');
  fs.writeFileSync(file, safeStorage.encryptString(text));
}

/** 保存済みの設定 { url, token? }。未設定なら undefined。 */
function getSettings() {
  try {
    return JSON.parse(readEncrypted(settingsPath()));
  } catch {
    return undefined;
  }
}

// トークンはこのホストにだけ送る。リダイレクト先（Releasesの実体など）には fetch の仕様で送られない。
const githubHosts = ['api.github.com', 'raw.githubusercontent.com'];
const isGitHubUrl = (url) => githubHosts.includes(new URL(url).hostname);

/**
 * GitHub向けの追加ヘッダー。プライベートリポジトリでは raw.githubusercontent.com のファイルか、
 * API（contents / releases/assets）のURLを manifest や `url` に書く。
 */
function githubHeaders(url, token) {
  const { hostname, pathname } = new URL(url);
  const headers = {};
  if (hostname === 'api.github.com') {
    headers.Accept = pathname.includes('/releases/assets/') ? 'application/octet-stream' : 'application/vnd.github.raw+json';
    headers['X-GitHub-Api-Version'] = '2022-11-28';
  }
  if (token && githubHosts.includes(hostname)) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** URLから manifest を取得し、形式を検証する。 */
async function downloadManifest(url, token) {
  const res = await fetch(url, { cache: 'no-store', headers: githubHeaders(url, token), signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    const hint = isGitHubUrl(url) && [401, 403, 404].includes(res.status)
      ? '。プライベートリポジトリの場合は、トークンと、その対象リポジトリ・権限（Contents の読み取り）・有効期限を確認してください'
      : '';
    throw new Error(`取得できません (HTTP ${res.status})${hint}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(await res.text());
  } catch {
    throw new Error('manifest の形式ではありません（JSONではない、または共有設定が「リンクを知っている全員」になっていない）');
  }
  if (!manifest || typeof manifest.games !== 'object' || manifest.games === null) {
    throw new Error('manifest の形式ではありません（"games" がありません）');
  }
  return manifest;
}

/** 一覧表示で同時に何件も問い合わせるため、短時間は取得結果を使い回す。 */
let manifestRequest;
let manifestFetchedAt = 0;
function loadManifest() {
  if (!manifestRequest || Date.now() - manifestFetchedAt > 10_000) {
    manifestFetchedAt = Date.now();
    manifestRequest = fetchManifest();
  }
  return manifestRequest;
}

/** 最新の manifest を取得する。オフライン時は前回取得分を使う。 */
async function fetchManifest() {
  const settings = getSettings();
  if (settings) {
    try {
      const manifest = await downloadManifest(settings.url, settings.token);
      writeEncrypted(manifestCachePath(), JSON.stringify(manifest));
      return manifest;
    } catch (error) {
      console.warn(`manifest の取得に失敗しました: ${error.message}`);
    }
  }
  try {
    return JSON.parse(readEncrypted(manifestCachePath()));
  } catch {
    return { games: {} };
  }
}

/** manifest の1件を検証する。`type: "web"` は unityroom などブラウザで遊ぶゲーム。 */
function validGame(game) {
  if (!game || !/^https?:\/\//.test(game.url ?? '')) return undefined;
  if (game.type === 'web') return game;
  return game.exe && game.version ? game : undefined;
}

async function getGame(id, manifest) {
  return validGame((manifest ?? (await loadManifest())).games?.[id]);
}

/** Google Driveの大きいファイルは確認ページ(HTML)が返るので、フォームの内容から実ファイルのURLを組み立てる。 */
async function fetchDownload(url) {
  const res = await fetch(url, { redirect: 'follow', headers: githubHeaders(url, getSettings()?.token) });
  if (!res.ok) throw new Error(`ダウンロードに失敗しました (HTTP ${res.status})`);
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  const html = await res.text();
  const action = html.match(/<form[^>]+action="([^"]+)"/)?.[1];
  if (!action) throw new Error('ダウンロードURLがファイルを返しませんでした（共有設定を確認してください）');
  const next = new URL(action.replace(/&amp;/g, '&'));
  for (const [, name, value] of html.matchAll(/<input[^>]+type="hidden"[^>]+name="([^"]+)"[^>]+value="([^"]*)"/g)) {
    next.searchParams.set(name, value);
  }
  const retry = await fetch(next, { redirect: 'follow' });
  if (!retry.ok || (retry.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error('Google Driveからファイルを取得できませんでした');
  }
  return retry;
}

/** ゲームを未導入ならダウンロード・展開し、展開先を返す。 */
async function install(id, game, progress) {
  const dir = path.join(gamesRoot(), id, game.version);
  if (installedVersion(id) === game.version) return dir;

  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
  const zipPath = path.join(gamesRoot(), id, `${game.version}.zip`);
  try {
    progress('ダウンロード中…');
    const res = await fetchDownload(game.url);
    const total = Number(res.headers.get('content-length')) || 0;
    let received = 0;
    const hash = crypto.createHash('sha256');
    const body = Readable.fromWeb(res.body);
    body.on('data', (chunk) => {
      received += chunk.length;
      hash.update(chunk);
      const mb = (received / 1024 / 1024).toFixed(1);
      progress(total ? `ダウンロード中… ${Math.floor((received / total) * 100)}% (${mb}MB)` : `ダウンロード中… ${mb}MB`);
    });
    await pipeline(body, fs.createWriteStream(zipPath));
    if (game.sha256 && hash.digest('hex') !== game.sha256.toLowerCase()) {
      throw new Error('ファイルのハッシュが manifest と一致しません');
    }

    progress('展開中…');
    // Windows 10以降に標準搭載の tar.exe (bsdtar) はzipを展開できる。
    // PATH 上の GNU tar（Git Bash 等）はzipを扱えないため、System32 の tar.exe を明示する。
    const tar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
    await new Promise((resolve, reject) => {
      execFile(tar,['-xf', zipPath, '-C', dir], (error) => (error ? reject(new Error(`展開に失敗しました: ${error.message}`)) : resolve()));
    });
    await fsp.writeFile(path.join(dir, '.installed'), new Date().toISOString());
  } catch (error) {
    await fsp.rm(dir, { recursive: true, force: true });
    throw error;
  } finally {
    await fsp.rm(zipPath, { force: true });
  }

  // 古いバージョンは削除する。
  for (const entry of await fsp.readdir(path.join(gamesRoot(), id))) {
    // 旧版が起動中などで消せない場合は次回に回す。
    if (entry !== game.version) await fsp.rm(path.join(gamesRoot(), id, entry), { recursive: true, force: true }).catch(() => {});
  }
  return dir;
}

const running = new Set();
const installing = new Map();

function broadcast(id, message) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send('launcher:progress', id, message);
  }
}

/** 同じゲームの取得が重複しないよう、進行中の取得があればそれを待つ。 */
function ensureInstalled(id, game) {
  const key = `${id}@${game.version}`;
  if (!installing.has(key)) {
    const task = install(id, game, (message) => broadcast(id, message)).finally(() => installing.delete(key));
    installing.set(key, task);
  }
  return installing.get(key);
}

/** 展開済み（.installed あり）のバージョン。なければ undefined。 */
function installedVersion(id) {
  const dir = path.join(gamesRoot(), id);
  if (!fs.existsSync(dir)) return undefined;
  return fs.readdirSync(dir).find((entry) => fs.existsSync(path.join(dir, entry, '.installed')));
}

/**
 * ゲームの取得状況。state は none（未登録）/ web（ダウンロード不要）/ missing（未取得）/
 * outdated（更新あり）/ installed（最新を取得済み）。
 */
async function gameStatus(id, manifest) {
  const game = await getGame(id, manifest);
  if (!game) return { state: 'none' };
  if (game.type === 'web') return { state: 'web' };
  const installed = installedVersion(id);
  const state = !installed ? 'missing' : installed === game.version ? 'installed' : 'outdated';
  return { state, installedVersion: installed, latestVersion: game.version };
}

function openWebGame(game) {
  const win = new BrowserWindow({ width: 1280, height: 800, autoHideMenuBar: true, webPreferences: { sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL(game.url);
}

/** 設定画面の入力を整える。トークンはGitHubのURLのときだけ使う。 */
function normalizeSettings(url, token) {
  try {
    if (new URL(url).protocol !== 'https:') throw new Error();
  } catch {
    throw new Error('https:// で始まるURLを入力してください');
  }
  return { url, token: isGitHubUrl(url) && token ? token : undefined };
}

/** 設定画面で入力された内容を検証し、有効なゲームの件数を返す。 */
async function checkSettings({ url, token }) {
  const manifest = await downloadManifest(url, token);
  return Object.values(manifest.games).filter(validGame).length;
}

ipcMain.handle('launcher:check-manifest', (_event, url, token) => checkSettings(normalizeSettings(url, token)));

ipcMain.handle('launcher:save-manifest', async (event, url, token) => {
  const settings = normalizeSettings(url, token);
  await checkSettings(settings);
  writeEncrypted(settingsPath(), JSON.stringify(settings));
  // 別の manifest の前回取得分を使わないよう、キャッシュも消す。
  fs.rmSync(manifestCachePath(), { force: true });
  manifestRequest = undefined;
  await loadSite(BrowserWindow.fromWebContents(event.sender));
});

/** 設定済みならサイトに戻る。未設定なら false。 */
ipcMain.handle('launcher:close-setup', async (event) => {
  if (!getSettings()) return false;
  await loadSite(BrowserWindow.fromWebContents(event.sender));
  return true;
});

ipcMain.handle('launcher:status', (_event, id) => gameStatus(id));

ipcMain.handle('launcher:download', async (_event, id) => {
  const game = await getGame(id);
  if (!game) throw new Error('このゲームは登録されていません');
  if (game.type === 'web') return;
  await ensureInstalled(id, game);
  broadcast(id, '');
});

/** 未取得・更新ありのゲームを順番に取得する。結果を件数で返す。 */
ipcMain.handle('launcher:download-all', async () => {
  const manifest = await loadManifest();
  const ids = [];
  for (const id of Object.keys(manifest.games ?? {})) {
    if (['missing', 'outdated'].includes((await gameStatus(id, manifest)).state)) ids.push(id);
  }
  const failed = [];
  for (const [i, id] of ids.entries()) {
    broadcast('*', `取得中… ${i + 1} / ${ids.length}（${id}）`);
    try {
      await ensureInstalled(id, await getGame(id, manifest));
    } catch (error) {
      failed.push(`${id}: ${error.message}`);
    }
    broadcast(id, '');
  }
  broadcast('*', '');
  return { total: ids.length, failed };
});

ipcMain.handle('launcher:play', async (_event, id) => {
  const progress = (message) => broadcast(id, message);
  if (running.has(id)) throw new Error('このゲームはすでに起動しています');
  const game = await getGame(id);
  if (!game) throw new Error('このゲームは登録されていません');
  if (game.type === 'web') return openWebGame(game);

  running.add(id);
  try {
    const dir = await ensureInstalled(id, game);
    const exe = path.resolve(dir, game.exe);
    if (!exe.startsWith(dir + path.sep) || !fs.existsSync(exe)) throw new Error(`実行ファイルが見つかりません: ${game.exe}`);

    const child = spawn(exe, game.args ?? [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore' });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    progress('プレイ中');
    child.once('exit', () => { running.delete(id); progress(''); });
    child.unref();
  } catch (error) {
    running.delete(id);
    throw error;
  }
});

let origin;
const loadSite = (win) => win.loadURL(`${origin}/`);
const loadSetup = (win) => win.loadFile(path.join(__dirname, 'setup.html'));

async function createWindow() {
  const port = await startSiteServer();
  origin = `http://127.0.0.1:${port}`;
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  // 外部リンクは既定のブラウザで開く。
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(origin)) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });
  // Ctrl+Shift+M で manifest のURLを設定し直す。
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'm') {
      event.preventDefault();
      loadSetup(win);
    }
  });
  if (getSettings()) loadSite(win);
  else loadSetup(win);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
