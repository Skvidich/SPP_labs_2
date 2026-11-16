import { useState } from 'react';
import { useQuery } from 'urql';
import { Link } from 'react-router-dom';
import { ARTISTS_QUERY } from '../graphql/queries.js';
import Filters from '../components/Filters.jsx';
import Pagination from '../components/Pagination.jsx';
import Loading from '../components/Loading.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import SourceBadge from '../components/SourceBadge.jsx';
import { buildListArgs, formatDate } from '../utils.js';

export default function ArtistsPage() {
  const [filters, setFilters] = useState({ search: '', source: '', sortField: 'title', sortDirection: 'asc' });
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);

  const [{ data, fetching, error }] = useQuery({
    query: ARTISTS_QUERY,
    variables: buildListArgs({ ...filters, offset, limit }),
  });

  const artists = data?.artists ?? [];

  const applyFilters = (next) => {
    setFilters(next);
    setOffset(0);
  };

  const handlePageChange = (nextOffset, nextLimit) => {
    if (nextOffset !== offset) setOffset(nextOffset);
    if (nextLimit !== limit) {
      setLimit(nextLimit);
      setOffset(0);
    }
  };

  return (
    <section>
      <h2>Исполнители</h2>
      <Filters
        onApply={applyFilters}
        sourcesEnabled
        sortFields={['title', 'createdAt']}
      />
      {fetching && <Loading />}
      <ErrorMessage error={error} />
      {!fetching && !error && (
        <>
          <div className="card-list">
            {artists.length === 0 && <div className="notice">Исполнители не найдены</div>}
            {artists.map((artist) => (
              <Link key={artist.id} className="card card-link" to={`/artists/${artist.id}`}>
                <div className="card-title">{artist.title}</div>
                <div className="card-meta">
                  <SourceBadge source={artist.source} />
                  {artist.description && <span className="card-description">{artist.description}</span>}
                  <span className="card-date">{formatDate(artist.createdAt)}</span>
                </div>
                <div className="card-meta">
                  <span className="card-sub">Треки: {artist.tracks?.length ?? 0}</span>
                </div>
              </Link>
            ))}
          </div>
          <Pagination offset={offset} limit={limit} hasItems={artists.length > 0} onPageChange={handlePageChange} />
        </>
      )}
    </section>
  );
}