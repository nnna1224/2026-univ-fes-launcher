/** GitHub Pagesのサブパスも考慮して内部リンク・public画像のURLを作る。 */
export function withBase(path = '/') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}

/** `/public/images/...` 形式も `/images/...` として扱う。 */
export function imageUrl(src: string) {
  return /^https?:\/\//.test(src) ? src : withBase(src.replace(/^\/?public\//, '/'));
}
