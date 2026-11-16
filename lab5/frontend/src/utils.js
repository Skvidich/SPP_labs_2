export const SOURCES = ['musicbrainz', 'itunes', 'audius'];

export const SORT_FIELDS = {
  artists: [
    { value: 'title', label: 'Названию' },
    { value: 'createdAt', label: 'Дате создания' },
  ],
  tracks: [
    { value: 'title', label: 'Названию' },
    { value: 'createdAt', label: 'Дате создания' },
  ],
};

export const SORT_FIELD_LABELS = {
  title: 'Название',
  createdAt: 'Дата создания',
};

export const SOURCE_LABELS = {
  musicbrainz: 'MusicBrainz',
  itunes: 'iTunes',
  audius: 'Audius',
};

export const EMPTY_SOURCE = '';

const COLLECTIONS_LIST_ARGS = { page: { limit: 100, offset: 0 }, sort: { field: 'title', direction: 'asc' } };

// urql has no client.invalidateQuery. Force a fresh network fetch of the
// collections list so the document cache is updated after a mutation.
export async function refetchCollections(client, query) {
  return client.query(query, COLLECTIONS_LIST_ARGS, { requestPolicy: 'network-only' }).toPromise();
}

// Builds the common list filter/sort/page arguments object for a GraphQL query.
export function buildListArgs({ search = '', source = '', sortField = 'title', sortDirection = 'asc', offset = 0, limit = 20 }) {
  const args = {
    page: { limit, offset },
    sort: { field: sortField, direction: sortDirection },
  };
  if (search && search.trim()) {
    args.search = search.trim();
  }
  if (source) {
    args.source = source;
  }
  return args;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}