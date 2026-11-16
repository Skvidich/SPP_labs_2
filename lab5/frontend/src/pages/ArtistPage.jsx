import { useState } from 'react';
import { useClient, useMutation, useQuery } from 'urql';
import { Link, useParams } from 'react-router-dom';
import { ADD_ITEM_TO_COLLECTION, ARTIST_QUERY, COLLECTIONS_QUERY } from '../graphql/queries.js';
import Loading from '../components/Loading.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import SourceBadge from '../components/SourceBadge.jsx';
import { formatDate, refetchCollections } from '../utils.js';

export default function ArtistPage() {
  const client = useClient();
  const { id } = useParams();
  const [pickedCollection, setPickedCollection] = useState('');

  const [{ data, fetching, error }] = useQuery({
    query: ARTIST_QUERY,
    variables: { id },
  });

  const [collData] = useQuery({ query: COLLECTIONS_QUERY, variables: { page: { limit: 100, offset: 0 }, sort: { field: 'title', direction: 'asc' } } });
  const collections = collData.data?.collections ?? [];

  const [addResult, addItem] = useMutation(ADD_ITEM_TO_COLLECTION);

  const artist = data?.artist;

  const handleAddTrack = async (trackId) => {
    if (!pickedCollection) return;
    const res = await addItem({ collectionId: pickedCollection, itemId: trackId });
    if (!res.error) {
      await refetchCollections(client, COLLECTIONS_QUERY);
    }
  };

  return (
    <section>
      <Link className="back-link" to="/">
        ← К списку исполнителей
      </Link>
      {fetching && <Loading />}
      <ErrorMessage error={error} />
      {!fetching && !error && artist && (
        <>
          <div className="detail-header">
            <h2>{artist.title}</h2>
            <SourceBadge source={artist.source} />
          </div>
          {artist.description && <p className="detail-description">{artist.description}</p>}
          {artist.url && (
            <p>
              <a href={artist.url} target="_blank" rel="noreferrer">
                Ссылка на источник
              </a>
            </p>
          )}
          <div className="card-meta">
            <span>Добавлен: {formatDate(artist.createdAt)}</span>
            <span>Источник: {artist.source} (id: {artist.sourceId})</span>
          </div>

          <h3>Треки исполнителя ({artist.tracks?.length ?? 0})</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Источник</th>
                <th>Дата</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {artist.tracks?.map((track) => (
                <tr key={track.id}>
                  <td>{track.title}</td>
                  <td>
                    <SourceBadge source={track.source} />
                  </td>
                  <td>{formatDate(track.createdAt)}</td>
                  <td>
                    <div className="inline-add">
                      <select
                        value={pickedCollection}
                        onChange={(e) => setPickedCollection(e.target.value)}
                      >
                        <option value="">Выберите подборку…</option>
                        {collections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                      <button disabled={!pickedCollection} onClick={() => handleAddTrack(track.id)}>
                        Добавить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {addResult.error && <ErrorMessage error={addResult.error} title="Ошибка добавления трека" />}
          {addResult.data && <div className="notice notice-success">Трек добавлен в подборку</div>}
        </>
      )}
    </section>
  );
}