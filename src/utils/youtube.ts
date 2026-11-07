/** YouTubeのURL（watch / youtu.be / shorts / embed）から動画IDを取り出す。 */
export const youtubeUrl = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
