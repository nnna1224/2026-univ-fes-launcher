/** ランチャー（Electron）の preload が公開するAPI。ブラウザで開いたときは undefined。 */
export interface GameStatus {
  state: 'none' | 'web' | 'missing' | 'outdated' | 'installed';
  installedVersion?: string;
  latestVersion?: string;
}

export interface LauncherApi {
  status(id: string): Promise<GameStatus>;
  play(id: string): Promise<void>;
  download(id: string): Promise<void>;
  downloadAll(): Promise<{ total: number; failed: string[] }>;
  onProgress(callback: (id: string, message: string) => void): void;
}

export const launcher = (window as unknown as { launcher?: LauncherApi }).launcher;

export function statusText({ state, installedVersion, latestVersion }: GameStatus) {
  switch (state) {
    case 'web': return 'Webゲーム（取得不要）';
    case 'missing': return `未取得（最新 v${latestVersion}）`;
    case 'outdated': return `更新あり（取得済み v${installedVersion} → 最新 v${latestVersion}）`;
    case 'installed': return `取得済み v${installedVersion}（最新）`;
    default: return '';
  }
}

export const needsDownload = (status: GameStatus) => status.state === 'missing' || status.state === 'outdated';

export function errorMessage(error: unknown) {
  // ipcRenderer.invoke の例外は "Error invoking remote method '...': Error: ..." 形式なので本文だけ取り出す。
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}
