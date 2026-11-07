import { defineConfig } from 'astro/config';

// GitHub Pagesの /リポジトリ名/ と、Cloudflare Pagesの / の両方に対応。
// GitHub Actionsから GITHUB_PAGES=true を渡した場合だけ自動で切り替える。
const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const isUserSite = repository?.toLowerCase() === `${owner?.toLowerCase()}.github.io`;
const base = isGitHubPages && repository && !isUserSite ? `/${repository}` : '/';
const site = process.env.SITE_URL || (isGitHubPages && owner ? `https://${owner}.github.io` : undefined);

export default defineConfig({
  output: 'static',
  base,
  site,
});
