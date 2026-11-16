import { sources } from '../config.js';
import { fetchJson } from '../fetch.js';
import { RateLimiter } from '../rateLimit.js';

const s = sources.musicbrainz;

const MUSICBRAINZ_TERMS = [
  'rock', 'pop', 'jazz', 'blues', 'classical', 'country', 'folk', 'metal',
  'reggae', 'soul', 'funk', 'disco', 'electronic', 'hip hop', 'indie',
  'punk', 'techno', 'house', 'ambient', 'latin', 'synthwave', 'progressive',
  'instrumental', 'soundtrack', 'ballad', 'acoustic', 'orchestral',
];

const USER_AGENT = 'music-catalog-collector/1.0 (teaching lab project)';

export function createMusicBrainzAdapter() {
  const limiter = new RateLimiter(s.rateMs);
  let termIdx = 0;
  let offset = 0;
  const pageSize = 100;
  let statsRef = null;

  const customQuery = String(process.env.MB_SEARCH_QUERY ?? '').trim();

  function attachStats(stats) {
    statsRef = stats;
  }

  function normalizeArtist(credit) {
    return {
      type: 'artist',
      title: credit.name,
      sourceId: credit.artist.id,
      source: 'musicbrainz',
      url: `https://musicbrainz.org/artist/${credit.artist.id}`,
      description: null,
      metadata: {
        disambiguation: credit.artist['disambiguation'] ?? null,
      },
    };
  }

  function normalizeTrack(recording) {
    const artist = recording['artist-credit']?.[0] ?? null;
    return {
      type: 'track',
      title: recording.title,
      sourceId: recording.id,
      source: 'musicbrainz',
      url: `https://musicbrainz.org/recording/${recording.id}`,
      description: null,
      metadata: {
        length: recording.length ?? null,
        firstReleaseDate: recording['first-release-date'] ?? null,
        artistCredit: (recording['artist-credit'] ?? []).map((a) => a.name),
      },
      artist: artist ? artist.artist.id : null,
    };
  }

  function currentQuery() {
    if (customQuery) return customQuery;
    return MUSICBRAINZ_TERMS[termIdx % MUSICBRAINZ_TERMS.length];
  }

  async function fetch() {
    await limiter.wait();
    const url = `${s.baseUrl}/recording?query=${encodeURIComponent(currentQuery())}&limit=${pageSize}&offset=${offset}&fmt=json`;
    const data = await fetchJson(url, { headers: { 'User-Agent': USER_AGENT } });
    const recordings = data.recordings ?? [];
    statsRef?.recordFetched(data.count ?? recordings.length);

    const items = [];
    const relations = [];
    const seenArtists = new Set();

    for (const rec of recordings) {
      const track = normalizeTrack(rec);
      items.push(track);
      if (track.artist && !seenArtists.has(track.artist)) {
        const artistCredit = (rec['artist-credit'] ?? []).find((a) => a.artist?.id === track.artist);
        if (artistCredit) {
          items.push(normalizeArtist(artistCredit));
          seenArtists.add(track.artist);
        }
      }
      if (track.artist) {
        relations.push({ parentSourceId: track.artist, childSourceId: track.sourceId });
      }
    }

    const nextOffset = offset + pageSize;
    if (recordings.length === 0 || nextOffset >= (data.count ?? 0)) {
      termIdx += 1;
      offset = 0;
    } else {
      offset = nextOffset;
    }

    return { source: 'musicbrainz', items, relations };
  }

  function resumeCycle() {
    termIdx = 0;
    offset = 0;
  }

  return { attachStats, fetch, resumeCycle };
}