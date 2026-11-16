import { useMemo, useState } from 'react';
import { useClient, useMutation, useQuery } from 'urql';
import {
  ADD_ITEM_TO_COLLECTION,
  COLLECTIONS_QUERY,
  CREATE_COLLECTION,
  DELETE_COLLECTION,
  REMOVE_ITEM_FROM_COLLECTION,
  TRACKS_QUERY,
  UPDATE_COLLECTION,
} from '../graphql/queries.js';
import Loading from '../components/Loading.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import SourceBadge from '../components/SourceBadge.jsx';
import { formatDate, refetchCollections } from '../utils.js';

const collectionsVars = { page: { limit: 100, offset: 0 }, sort: { field: 'title', direction: 'asc' } };

export default function CollectionsPage() {
  const [{ data, fetching, error }] = useQuery({
    query: COLLECTIONS_QUERY,
    variables: collectionsVars,
    requestPolicy: 'cache-and-network',
  });
  const collections = useMemo(() => data?.collections ?? [], [data]);

  const [editing, setEditing] = useState(null); // null | {mode:'create'} | {mode:'edit', collection}
  const [activeCollectionId, setActiveCollectionId] = useState(null);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const activeCollection = collections.find((c) => c.id === activeCollectionId) || null;

  return (
    <section>
      <h2>Подборки</h2>
      {fetching && <Loading />}
      <ErrorMessage error={error} />
      {notice && <div className="notice notice-success">{notice}</div>}
      {errorMsg && <div className="notice notice-error">{errorMsg}</div>}

      <button className="primary" onClick={() => setEditing({ mode: 'create' })}>
        Создать подборку
      </button>

      {!fetching && !error && (
        <div className="collections-layout">
          <div className="card-list">
            {collections.length === 0 && <div className="notice">Подборки не найдены</div>}
            {collections.map((c) => (
              <div
                key={c.id}
                className={`card ${activeCollection?.id === c.id ? 'card-active' : ''}`}
                onClick={() => setActiveCollectionId(c.id)}
              >
                <div className="card-title">{c.title}</div>
                <div className="card-meta">
                  {c.description && <span>{c.description}</span>}
                  <span>Элементов: {c.items?.length ?? 0}</span>
                  <span>{formatDate(c.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>

          {activeCollection && (
            <CollectionDetail
              collection={activeCollection}
              onEdit={() => setEditing({ mode: 'edit', collection: activeCollection })}
              onDeleted={(id) => {
                setActiveCollectionId(null);
                setEditing(null);
              }}
              setNotice={setNotice}
              setError={setErrorMsg}
            />
          )}
        </div>
      )}

      {editing && (
        <CollectionForm
          mode={editing.mode}
          collection={editing.collection}
          onClose={() => setEditing(null)}
          onSaved={(createdCollection) => {
            if (createdCollection) setActiveCollectionId(createdCollection.id);
            setEditing(null);
          }}
          setNotice={setNotice}
          setError={setErrorMsg}
        />
      )}
    </section>
  );
}

function CollectionDetail({ collection, onEdit, onDeleted, setNotice, setError }) {
  const client = useClient();
  const [, deleteCollection] = useMutation(DELETE_COLLECTION);
  const [removeResult, removeItem] = useMutation(REMOVE_ITEM_FROM_COLLECTION);
  const [, addItem] = useMutation(ADD_ITEM_TO_COLLECTION);
  const [pickedTrack, setPickedTrack] = useState('');
  const [addingOpen, setAddingOpen] = useState(false);

  const [trackData] = useQuery({
    query: TRACKS_QUERY,
    variables: { page: { limit: 100, offset: 0 }, sort: { field: 'title', direction: 'asc' } },
    pause: !addingOpen,
  });

  const handleDelete = async () => {
    if (!window.confirm(`Удалить подборку «${collection.title}»?`)) return;
    const res = await deleteCollection({ id: collection.id });
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setNotice(`Подборка «${collection.title}» удалена`);
    await refetchCollections(client, COLLECTIONS_QUERY);
    onDeleted(collection.id);
  };

  const handleRemoveItem = async (itemId) => {
    const res = await removeItem({ collectionId: collection.id, itemId });
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setNotice('Элемент удалён из подборки');
    await refetchCollections(client, COLLECTIONS_QUERY);
  };

  const handleAddItem = async () => {
    if (!pickedTrack) return;
    const res = await addItem({ collectionId: collection.id, itemId: pickedTrack });
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setPickedTrack('');
    setNotice('Трек добавлен в подборку');
    await refetchCollections(client, COLLECTIONS_QUERY);
  };

  const availableTracks = (trackData.data?.tracks ?? []).filter((t) => !collection.items.some((it) => it.id === t.id));

  return (
    <div className="collection-detail">
      <div className="detail-header">
        <h3>{collection.title}</h3>
        <div>
          <button className="primary" onClick={onEdit}>
            Изменить
          </button>
          <button className="danger" onClick={handleDelete}>
            Удалить
          </button>
        </div>
      </div>
      {collection.description && <p className="detail-description">{collection.description}</p>}
      <div className="card-meta">
        <span>Создана: {formatDate(collection.createdAt)}</span>
        <span>Обновлена: {formatDate(collection.updatedAt)}</span>
      </div>

      <h4>Содержимое ({collection.items?.length ?? 0})</h4>
      {collection.items?.length === 0 && <div className="notice">В подборке пока нет элементов</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Тип</th>
            <th>Источник</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {collection.items?.map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.type}</td>
              <td>
                <SourceBadge source={item.source} />
              </td>
              <td>
                <button className="danger" onClick={() => handleRemoveItem(item.id)}>
                  Убрать
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {addingOpen && (
        <div className="inline-add">
          <select value={pickedTrack} onChange={(e) => setPickedTrack(e.target.value)}>
            <option value="">Выберите трек…</option>
            {availableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button disabled={!pickedTrack} onClick={handleAddItem}>
            Добавить
          </button>
        </div>
      )}
      <button className="secondary" onClick={() => setAddingOpen((v) => !v)}>
        {addingOpen ? 'Скрыть выбор треков' : 'Добавить трек'}
      </button>
      {removeResult.error && <ErrorMessage error={removeResult.error} />}
    </div>
  );
}

function CollectionForm({ mode, collection, onClose, onSaved, setNotice, setError }) {
  const client = useClient();
  const [title, setTitle] = useState(collection?.title ?? '');
  const [description, setDescription] = useState(collection?.description ?? '');

  const [, createCollection] = useMutation(CREATE_COLLECTION);
  const [, updateCollection] = useMutation(UPDATE_COLLECTION);

  const isEdit = mode === 'edit';

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Название обязательно');
      return;
    }
    const input = { title: title.trim(), description: description.trim() || null };
    let res;
    if (isEdit) {
      res = await updateCollection({ id: collection.id, input });
    } else {
      res = await createCollection({ input });
    }
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setNotice(isEdit ? 'Подборка обновлена' : 'Подборка создана');
    await refetchCollections(client, COLLECTIONS_QUERY);
    onSaved(res.data?.createCollection ?? res.data?.updateCollection ?? null);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{isEdit ? 'Изменить подборку' : 'Создать подборку'}</h3>
        <form onSubmit={submit}>
          <label>
            Название:
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Описание:
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="modal-actions">
            <button type="submit" className="primary">
              Сохранить
            </button>
            <button type="button" onClick={onClose}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}