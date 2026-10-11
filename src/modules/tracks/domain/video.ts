// Vídeo das aulas: só links do YouTube e do Vimeo (o frontend embute o player deles).
// Qualquer formato aceito vira o link canônico, que é o que fica guardado.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

// null = não é um link de vídeo aceito.
export function canonicalVideoUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  let youtubeId: string | null | undefined;
  if (host === 'youtu.be') youtubeId = segments[0];
  else if (YOUTUBE_HOSTS.has(host)) {
    if (segments[0] === 'watch') youtubeId = url.searchParams.get('v');
    else if (segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live') youtubeId = segments[1];
  }
  if (youtubeId !== undefined) return youtubeId !== null && YOUTUBE_ID.test(youtubeId) ? `https://www.youtube.com/watch?v=${youtubeId}` : null;

  if (VIMEO_HOSTS.has(host)) {
    const id = host === 'player.vimeo.com' ? (segments[0] === 'video' ? segments[1] : undefined) : segments[0];
    return id !== undefined && /^\d{6,12}$/.test(id) ? `https://vimeo.com/${id}` : null;
  }
  return null;
}
