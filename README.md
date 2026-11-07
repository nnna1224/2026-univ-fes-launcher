# G^2 学祭ゲーム紹介サイト テンプレート

Astro の静的サイトです。ゲームをMarkdown 1ファイルで増やせます。
GitHub Pages / Cloudflare Pages の両方に対応し、サーバー・データベースは不要です。

## 開始方法

必要なもの: Node.js 26.13.0 以上、npm。

```bash
# 初回のみ: 依存の解決結果をロックファイルに記録（インストールスクリプトは実行しない）
npm install --package-lock-only --ignore-scripts
# 既知の脆弱性を検査（依存関係の安全を完全に保証するものではありません）
npm audit --audit-level=high
# ロックされた依存関係をインストール
npm ci --ignore-scripts
npm run dev
```

ブラウザで `http://localhost:4321` を開いてください。
静的サイトのビルドは `npm run build`、ビルド後の確認は `npm run preview` です。
**`package-lock.json` は初回に作成して内容を確認したうえでGit管理に含めてください。** 未作成の場合、GitHub Actionsは安全側に倒してビルドを停止します。
依存更新時もロックファイルをレビューし、`npm audit` とビルドを再実行してください。

**最初にすること:** `src/config/site.ts` の見出し・リンクを編集し、各作品の画像・試遊情報を必要に応じて埋めてください。

## 新しいゲームを追加する

1. `examples/new-game.md.example` を `src/content/games/your-game.md` にコピー。
2. `title` と `summary` を編集。必要なら `genre` / `accent` を追加。
3. 画像があれば `public/images/your-game/` に置いて `cover` / `screenshots` に記載。
4. 学祭の展示が決まったら `event` を入力。不要・未定の項目は消してかまいません。
5. `npm run build` で確認。

ファイル名 `your-game.md` はそのままページのURL `/games/your-game/` になります。
トップページのカードと詳細ページは自動で生成され、ページやルーティングの追加作業は不要です。

最小のデータは次のように書けます。

```markdown
---
title: "新しいゲーム"
summary: "簡単なゲーム紹介。"
---

ここにゲームの詳しい説明を記述します。
```

### 登録できる項目

| 項目 | 必須 | 説明 |
|---|---|---|
| `title` | ○ | ゲーム名 |
| `summary` | ○ | 一覧・詳細に表示する短い説明 |
| `genre` | - | ジャンル |
| `cover` | - | メイン画像（`/images/...`） |
| `video` | - | 詳細ページの動画。YouTubeのURLのみ。指定時は `cover` の代わりに表示 |
| `screenshots` | - | 画面画像の配列 |
| `accent` | - | `cyan` / `pink` / `orange` / `violet` / `lime` |
| `order` | - | 一覧の順番。省略時は末尾（同順位なら名称順） |
| `event.playTimeMinutes` | - | 1プレイ目安の時間（分、正の整数） |
| `event.players` | - | プレイ人数（例: `1人`） |
| `event.controls` | - | 操作方法の配列 |
| `event.notes` | - | 注意事項、混雑時の案内など |
| `development.engine` | - | ゲームエンジン（例: `Unity`） |
| `development.languages` | - | 実装言語の配列（例: `["C#"]`） |
| `development.period` | - | 開発期間（例: `2026年4月〜10月`） |
| `development.team` | - | 開発人数（例: `3人`） |
| `development.notes` | - | 使用ツールなど開発に関する補足 |
| `links` | - | 外部リンク（`label` / `url` の配列） |

ゲーム説明や遊び方、特徴など長いテキストはMarkdownの本文に自由に書けます。
公開作品の画像が未設定なら装飾プレースホルダーを表示し、`event` が未入力なら展示情報欄は表示しません。`development` も同様です。

## Windowsランチャー

サイトと同じ画面をデスクトップアプリ（Electron）で表示し、詳細ページの「このゲームで遊ぶ」からゲームを起動できます。
ゲーム本体はランチャーに同梱せず、起動のたびにリモートの manifest を確認し、新しいバージョンがあれば自動でダウンロードしてから起動します。
遊ぶときの待ち時間をなくすため、トップページの「ゲームの事前取得」から全ゲームまたは個別のゲームを事前に取得できます（ランチャー内でのみ表示）。**ゲームを更新してもランチャーの再配布は不要です。**

### 仕組み

1. 画面の表示時や「このゲームで遊ぶ」「取得」を押したときに、`launcher.config.json` の `manifestUrl` から manifest を取得します（5秒以内に取得できない場合は前回取得した manifest、それもなければ同梱の `manifest.json`）。
   取得状況（未取得 / 更新あり / 取得済み）と、取得済み・最新のバージョンをトップページの一覧と詳細ページに表示します。
   ダウンロードは「すべて取得」「取得」「事前に取得」を押したとき、または未取得のゲームを遊ぶときにだけ行います。
2. 同じバージョンが導入済みでなければ zip をダウンロードし、`sha256` を検証して `%APPDATA%/<アプリ名>/games/<slug>/<version>/` に展開します。古いバージョンは削除します。
3. `exe` を起動します。manifest に登録のないゲームには、ボタンを表示しません。
4. `"type": "web"` のゲーム（unityroom などのWebゲーム）は、ダウンロードせず `url` をランチャーの別ウィンドウで開きます。

当日の待ち時間をなくすため、前日までに会場のPCでトップページの「すべて取得」を実行しておいてください。

### manifest の書き方

キーはゲームのMarkdownのファイル名（slug）です。例は `examples/manifest.json.example` にあります。

| 項目 | 必須 | 説明 |
|---|---|---|
| `type` | - | `web` でWebゲーム（`url` のみ必須）。省略時はzip配布のゲーム |
| `version` | ○ | 変更すると次回の起動時に再ダウンロードされる |
| `url` | ○ | ゲームを zip に固めたファイルのURL。https で直接ダウンロードできれば置き場所は自由（GitHub Releases、Google Drive の `https://drive.google.com/uc?export=download&id=<ID>`、学内サーバーなど） |
| `exe` | ○ | zip内の実行ファイルのパス |
| `sha256` | - | zipのSHA-256。改ざんや破損の検出のため推奨 |
| `args` | - | 起動引数の配列 |

manifest 自体は、例えばGitHubリポジトリに置いて raw URL（`https://raw.githubusercontent.com/<owner>/<repo>/main/manifest.json`）を `manifestUrl` に設定します。Google Driveに置く場合は「リンクを知っている全員」に共有してください。

### 開発・ビルド

```bash
npm ci --ignore-scripts
# ignore-scripts のため Electron 本体のダウンロードを明示的に実行する
npm run electron:install
# サイトをビルドしてランチャーを起動
npm run launcher
# Windows 用インストーラー / ポータブル版を dist-electron/ に作成
npm run dist:win
```

展開には Windows 10 以降に標準搭載の `tar.exe` を使います。
Windows 以外で `dist:win` を実行する場合、electron-builder が Wine などを必要とすることがあります。Windows 上でのビルドを推奨します。

## GitHub Pages への公開

`.github/workflows/deploy.yml` に静的サイトのデプロイ設定があります。

1. このテンプレート一式を新しい GitHub リポジトリに配置します（既存のリポジトリへ組み込む際は既存構成とAGENTS.mdを優先してください）。
2. GitHubの `Settings > Pages > Build and deployment > Source` で **GitHub Actions** を選択します。
3. 初回に `package-lock.json` を生成・レビューしてリポジトリに含めます。未作成の場合は依存を再現できないためデプロイを停止します。
4. リポジトリの `main` ブランチへのpush、またはActionsの手動実行で脆弱性チェック・ビルド・公開されます。

GitHub Actionsのビルド時だけ `GITHUB_PAGES=true` を設定しているので、
`https://<username>.github.io/<repository>/` のようなサブパスにも自動で対応します。
`<username>.github.io` リポジトリならルート公開となります。

独自ドメインを使う場合は `SITE_URL` とデプロイ環境を必要に応じて調整してください。

## Cloudflare Pages への公開

GitHubリポジトリをCloudflare Pagesに接続し、以下を指定します。

| 設定 | 値 |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Production branch | `main`（実際に利用するブランチ） |
| Node.js | `26.13.0`（`.nvmrc` に記載） |

Cloudflare Pagesでも、事前に生成・レビューした `package-lock.json` をGit管理に含めてください。`.npmrc` により依存インストール時のライフサイクルスクリプトは既定で無効になります。
Cloudflare Pagesでは `GITHUB_PAGES` を設定しないでください。サイトは `/` で配信されます。
Astroの静的出力のみなので `@astrojs/cloudflare` アダプターは使いません。

## npm依存関係のセキュリティ

- `astro` の直接依存は既知の特定バージョン `7.4.5` に固定しています。ただし、直接依存だけを固定しても間接依存は固定されません。
- `.npmrc` の `ignore-scripts=true` で `preinstall` / `install` / `postinstall` などのライフサイクルスクリプトの自動実行を防ぎます。`npm run build` など明示的に起動した処理では依存コードが実行されるため、**完全な防御ではありません**。
- `package-lock.json` は今回のテンプレートに同梱していません（作成環境からnpmレジストリに接続できないため）。**初回の依存解決をした時点でロックファイルを確認し、Gitに含めてください**。ロックファイル内の想定外のパッケージ・ダウンロード元・更新に注意してください。
- `npm audit` は公表済みの脆弱性のチェックであり、未報告の悪意あるパッケージは見逃す場合があります。ロックファイルと依存の追加・変更内容のレビューが重要です。
- GitHub Actions は `npm ci --ignore-scripts` と `npm audit --audit-level=high` を使用し、ロックファイルがない場合はデプロイを停止します。依存コードを実行するビルドジョブとPages公開権限を持つデプロイジョブを分離しています。Cloudflare Pagesでも通常のビルドに加えて定期的な監査を推奨します。
- インストールスクリプトを無効にした影響で一部環境のビルドが失敗する場合、すべてを一括で許可せず、必要な依存とスクリプトを個別に確認してから判断してください。

## プロジェクト構成

```text
src/
  config/site.ts            学祭全体の設定
  content.config.ts         ゲーム情報のスキーマ
  content/games/*.md        ゲームごとのデータ・紹介文
  components/GameCard.astro 一覧カード
  layouts/BaseLayout.astro  共通ヘッダー・フッター
  pages/index.astro         トップページ
  pages/games/[id].astro    詳細ページ共通テンプレート
  styles/global.css         スタイル
  utils/paths.ts            GitHub Pages用パス補正
  utils/games.ts            表示順・公開フィルタ等
examples/new-game.md.example 追加用の記入サンプル
public/images/             画像置き場
```

## 初期データについて

公開資料にある5作品（コクリコクラレ、ポンコツmusica、ねこパズル、探シモノ、suspenseless）を簡単な紹介文で収録しています。
参照: https://g-2-yama.github.io/docs

画像、当日の展示状況、試遊時間、操作方法などは**未確認のため登録していません**。
実データを用意できた項目から追記してください。詳細なゲームジャンル等、説明を推測した箇所は公開前に校正してください。

## 運用上の注意

- コミットやGitHubへのpush、Cloudflareへの接続はこのテンプレートの作成時には実施していません。
- 外部リンクは新しいタブで開きます。
- デザインはPCとスマートフォンの両方を想定しています。実機での表示・操作は公開前に確認してください。
- 画像にはできればWebPを使用してください。大きすぎる画像は表示速度に影響します。
