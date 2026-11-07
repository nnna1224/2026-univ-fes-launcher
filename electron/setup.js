// manifest のURLを入力・検証・保存する設定画面。
const input = document.getElementById('url');
const result = document.getElementById('result');
const saveButton = document.getElementById('save');

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
    const count = await window.launcher.checkManifest(input.value.trim());
    show('ok', `✅ 有効な manifest です（${count} 件のゲームが登録されています）`);
    saveButton.disabled = false;
  } catch (error) {
    show('ng', `❌ ${errorText(error)}`);
  }
}

input.addEventListener('input', () => { saveButton.disabled = true; result.className = ''; });
input.addEventListener('keydown', (event) => { if (event.key === 'Enter') check(); });
document.getElementById('check').addEventListener('click', check);
saveButton.addEventListener('click', async () => {
  try {
    await window.launcher.saveManifest(input.value.trim());
  } catch (error) {
    show('ng', `❌ ${errorText(error)}`);
  }
});
document.getElementById('back').addEventListener('click', async () => {
  if (!(await window.launcher.closeSetup())) show('ng', '❌ まだ manifest が設定されていません');
});
