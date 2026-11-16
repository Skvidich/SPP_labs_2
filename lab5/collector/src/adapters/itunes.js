import { sources } from '../config.js';
import { fetchJson } from '../fetch.js';
import { RateLimiter } from '../rateLimit.js';

const s = sources.itunes;

const SEARCH_TERMS = [
  'rock', 'pop', 'jazz', 'classical', 'hip hop', 'electronic', 'blues',
  'country', 'folk', 'metal', 'reggae', 'rnb', 'indie', 'punk', 'ambient',
  'soul', 'disco', 'funk', 'techno', 'house', 'grunge', 'progressive',
  'latin', 'soundtrack', 'instrumental', 'cinematic', 'synthwave', 'lo-fi',
  '80s', '90s', '2000s', 'dance', 'trance', 'dubstep', 'drum and bass',
  'drum & bass', 'trap', 'jpop', 'kpop', 'cpop', 'bollyween', 'west african',
  'afrobeats', 'ska', 'swing', 'big band', 'bebop', 'gospel', 'zydeco',
  'celtic', 'bluegrass', 'chamber', 'opera', 'baroque', 'romantic',
  'lounge', 'exotica', 'nueva cancion', 'bossanova', 'samba', 'tango',
  'flamenco', 'canci-n', 'vietnamese', 'indian classical', 'bhangra',
  'psychedelic rock', 'shoegaze', 'math rock', 'post-punk', 'new wave',
  'synthpop', 'darkwave', 'industrial', 'noise', 'drone', 'vaporwave',
  'chiptune', 'ambient techno', 'deep house', 'progressive house',
  'minimal', 'idm', 'breakbeat', 'garage rock', 'surf rock', 'pub rock',
  'southern rock', 'hard bop', 'cool jazz', 'fusion', 'swing jazz',
  'newwave', 'city pop', 'sophisti-pop', 'dream pop', 'trip hop',
  'acid jazz', 'new jack swing', 'quiet storm', 'slow jam', 'doo-wop',
  'rockabilly', 'honky tonk', 'outlaw country', 'americana',
];

export function createItunesAdapter() {
  const limiter = new RateLimiter(s.rateMs);
  let termIdx = 0;
  let offset = 0;
  const limit = 200;
  let statsRef = null;

  function attachStats(stats) {
    statsRef = stats;
  }

  function normalize(result) {
    if (result.kind !== 'song' || !result.trackId) return null;
    return {
      type: 'track',
      title: result.trackName,
      sourceId: `track-${result.trackId}`,
      source: 'itunes',
      url: result.trackViewUrl ?? null,
      description: result.collectionName ?? null,
      metadata: {
        artistName: result.artistName,
        albumId: result.collectionId ?? null,
        releaseDate: result.releaseDate ?? null,
      },
      artistKey: result.artistId ? `artist-${result.artistId}` : null,
      artistName: result.artistName,
      artistGenre: result.primaryGenreName ?? null,
    };
  }

  async function fetch() {
    const term = SEARCH_TERMS[termIdx];
    await limiter.wait();
    const params = new URLSearchParams({
      term,
      media: 'music',
      entity: 'song',
      limit: String(limit),
      offset: String(offset),
    });
    const url = `${s.baseUrl}/search?${params.toString()}`;
    const data = await fetchJson(url);
    const results = data.results ?? [];
    statsRef?.recordFetched(data.resultCount ?? results.length);

    const items = [];
    const relations = [];
    const seenArtistKeys = new Set();

    for (const r of results) {
      const track = normalize(r);
      if (!track || track.type !== 'track') continue;

      items.push(track);

      const artistKey = track.artistKey;
      if (track.artistName && artistKey && !seenArtistKeys.has(artistKey)) {
        items.push({
          type: 'artist',
          title: track.artistName,
          sourceId: artistKey,
          source: 'itunes',
          url: null,
          description: null,
          metadata: { primaryGenre: track.artistGenre },
        });
        seenArtistKeys.add(artistKey);
      }

      if (artistKey) {
        relations.push({ parentSourceId: artistKey, childSourceId: track.sourceId });
      }
    }

    const resultCount = data.resultCount ?? results.length;
    const nextOffset = offset + limit;
    if (nextOffset >= resultCount || results.length === 0) {
      // Переходим к следующему поисковому термину.
      termIdx = (termIdx + 1) % SEARCH_TERMS.length;
      offset = 0;
    } else {
      offset = nextOffset;
    }

    return { source: 'itunes', items, relations };
  }

  function resumeCycle() {
    termIdx = 0;
    offset = 0;
  }

  return { attachStats, fetch, resumeCycle };
}