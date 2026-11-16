import { useState } from 'react';
import { useQuery } from 'urql';
import { TRACKS_QUERY } from '../graphql/queries.js';
import Filters from '../components/Filters.jsx';
import Pagination from '../components/Pagination.jsx';
import Loading from '../components/Loading.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import SourceBadge from '../components/SourceBadge.jsx';
import { buildListArgs, formatDate } from '../utils.js';

export default function TracksPage() {
  const [filters, setFilters] = useState({ search: '', source: '', sortField: 'title', sortDirection: 'asc' });
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);

  const [{ data, fetching, error }] = useQuery({
    query: TRACKS_QUERY,
    variables: buildListArgs({ ...filters, offset, limit }),
  });

  const tracks = data?.tracks ?? [];

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
      <h2>Треки</h2>
      <Filters onApply={applyFilters} sourcesEnabled sortFields={['title', 'createdAt']} />
      {fetching && <Loading />}
      <ErrorMessage error={error} />
      {!fetching && !error && (
        <>
          {tracks.length === 0 && <div className="notice">Треки не найдены</div>}
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Источник</th>
                <th>Описание</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track) => (
                <tr key={track.id}>
                  <td>{track.title}</td>
                  <td>
                    <SourceBadge source={track.source} />
                  </td>
                  <td>{track.description || '—'}</td>
                  <td>{formatDate(track.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination offset={offset} limit={limit} hasItems={tracks.length > 0} onPageChange={handlePageChange} />
        </>
      )}
    </section>
  );
}