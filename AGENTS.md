# Repository Guidelines

このリポジトリは、学祭向けの静的なゲーム紹介サイトです。

- SSG は Astro。静的 HTML のみを生成するため、サーバー、DB、SSR アダプターは原則追加しない。
- 新規ゲームは `src/content/games/<slug>.md` を追加。定義は `src/content.config.ts`。ページを個別に複製しない。
- 未確定の展示情報や画像は、推測で追加せず省略する。
- 画像は `public/images/<slug>/` に置き、Markdownには `/images/...` のURLを記載する。
- サイト共通の学祭情報は `src/config/site.ts`。ゲーム固有の試遊情報は各Markdownの `event` に記載。
- 内部リンク、public画像へのパスは `src/utils/paths.ts` を使用。GitHub Pages のベースパスを壊さない。
- 依存追加や大規模リファクタリングを避ける。変更後は `npm run build` を実行し、表示確認と区別して報告する。
- デプロイ方法は README.md を参照。コミット、PR、マージ、デプロイは依頼がない限り実施しない。
- APIキー、トークンなどの秘密情報はリポジトリに記録しない。
- npm 依存関係は直接依存のバージョンを固定し、生成した `package-lock.json` をレビューしてGit管理に含める。インストール時は既定でライフサイクルスクリプトを無効化する。

## Windowsランチャー（Electron）

- `src/` 以下は https://github.com/nnna1224/2026-univ-fes-site のサイトと同じ画面を保つ。ランチャー固有の表示は詳細ページの「このゲームで遊ぶ」（`window.launcher` があるときだけ表示）に限る。
- ランチャー本体は `electron/`。ゲームの配布情報は `launcher.config.json` の `manifestUrl` が指すリモートの manifest で管理し、ゲーム更新でランチャーの再配布が不要な状態を保つ。
- 手順は README.md の「Windowsランチャー」を参照。
