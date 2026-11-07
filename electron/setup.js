// manifest のURLを入力・検証・保存する設定画面。
const input = document.getElementById('url');
const result = document.getElementById('result');
const saveButton = document.getElementById('save');
const tokenInput = document.getElementById('token');
const tokenField = document.getElementById('token-field');

// main.cjs の githubHosts と同じ。トークン欄はGitHubのURLのときだけ表示する。
const githubHosts = ['api.github.com', 'raw.githubusercontent.com'];
function isGitHubUrl(url) {
  try {
    return githubHosts.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const values = () => [input.value.trim(), isGitHubUrl(input.value.trim()) ? tokenInput.value.trim() : ''];

function show(state, message) {
  result.className = state;
  result.textContent = message;
}

// main プロセスのエラーは "Error invoking remote method ...: Error: <本文>" の形で届く。
const errorText = (error) => String(error.message ?? error).replace(/^.*Error: /, '');

async function check() {
  saveButton.disabled = true;
  show('busy', '確認中…');
  try {
    const count = await window.launcher.checkManifest(...values());
    show('ok', `✅ 有効な manifest です（${count} 件のゲームが登録されています）`);
    saveButton.disabled = false;
  } catch (error) {
    show('ng', `❌ ${errorText(error)}`);
  }
}

function onEdit() {
  saveButton.disabled = true;
  result.className = '';
  tokenField.hidden = !isGitHubUrl(input.value.trim());
}
input.addEventListener('input', onEdit);
tokenInput.addEventListener('input', onEdit);
tokenInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') check(); });
input.addEventListener('keydown', (event) => { if (event.key === 'Enter') check(); });
document.getElementById('check').addEventListener('click', check);
saveButton.addEventListener('click', async () => {
  try {
    await window.launcher.saveManifest(...values());
  } catch (error) {
    show('ng', `❌ ${errorText(error)}`);
  }
});
document.getElementById('back').addEventListener('click', async () => {
  if (!(await window.launcher.closeSetup())) show('ng', '❌ まだ manifest が設定されていません');
});
