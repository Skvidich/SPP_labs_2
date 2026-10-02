import React, { useState, useRef } from 'react';
import { Form } from './Form';
import { apiRequest } from '../api';

export function EntitySection({
  title,
  description,
  items,
  loading,
  allMovies,
  canEdit,
  canDelete,
  renderFormFields,
  onCreate,
  onSaveEdit,
  onDelete,
  onUploadPoster,
  onAddMovie,
  onRemoveMovie
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section className="section">
      <div className="section-header">
        <div>
          <h2>{title}</h2>
          <p className="section-description">{description}</p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setShowCreate(true)}>
            Добавить
          </button>
        )}
      </div>

      {showCreate && canEdit && (
        <Form
          title={`Новая запись: ${title}`}
          onSubmit={(fd, reset) =>
            onCreate(fd, () => {
              reset();
              setShowCreate(false);
            })
          }
          onCancel={() => setShowCreate(false)}
        >
          {renderFormFields()}
        </Form>
      )}

      <div className="cards">
        {loading && <p className="empty">Загрузка данных...</p>}
        {!loading && items.length === 0 && <p className="empty">В этом разделе пока ничего нет.</p>}
        {items.map((item) => (
          <EntityCard
            key={item.id}
            item={item}
            allMovies={allMovies}
            canEdit={canEdit}
            canDelete={canDelete}
            renderFormFields={renderFormFields}
            onSaveEdit={onSaveEdit}
            onDelete={onDelete}
            onUploadPoster={onUploadPoster}
            onAddMovie={onAddMovie}
            onRemoveMovie={onRemoveMovie}
          />
        ))}
      </div>
    </section>
  );
}

function EntityCard({
  item,
  allMovies,
  canEdit,
  canDelete,
  renderFormFields,
  onSaveEdit,
  onDelete,
  onUploadPoster,
  onAddMovie,
  onRemoveMovie
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showAddMovie, setShowAddMovie] = useState(false);
  const [showListMovies, setShowListMovies] = useState(false);
  const [listMovies, setListMovies] = useState([]);
  const fileRef = useRef(null);

  const loadMovies = async () => {
    const data = await apiRequest(`/lists/${item.id}/movies`);
    setListMovies(data || []);
  };

  const toggleMovies = async () => {
    if (!showListMovies) await loadMovies();
    setShowListMovies(!showListMovies);
  };

  if (isEditing && canEdit) {
    return (
      <article className="card editing">
        <Form
          title="Редактирование"
          onSubmit={(fd) => onSaveEdit(item.id, fd, () => setIsEditing(false))}
          onCancel={() => setIsEditing(false)}
        >
          {renderFormFields(item)}
        </Form>
      </article>
    );
  }

  const isMovie = item.title !== undefined;

  return (
    <article className="card">
      {isMovie && (
        <div className="poster-wrapper">
          {item.poster_path ? (
            <img className="poster" src={item.poster_path} alt={item.title} />
          ) : (
            <div className="poster-placeholder" style={{ fontSize: '0.85rem' }}>Нет постера</div>
          )}
        </div>
      )}

      <h3>{item.title || item.name}</h3>
      {item.director && <p>Режиссёр: {item.director}</p>}
      {item.year && <p>Год: {item.year}</p>}
      {item.description !== undefined && <p>{item.description || 'Без описания'}</p>}

      <div className="card-actions">
        {onAddMovie && (
          <button type="button" className="secondary" onClick={toggleMovies}>
            {showListMovies ? 'Скрыть' : 'Состав'}
          </button>
        )}

        {onAddMovie && canEdit && (
          <button type="button" className="secondary" onClick={() => setShowAddMovie(true)}>
            + Фильм
          </button>
        )}

        {canEdit && (
          <button type="button" className="secondary" onClick={() => setIsEditing(true)}>
            Изменить
          </button>
        )}

        {onUploadPoster && canEdit && (
          <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
            Постер
          </button>
        )}

        {canDelete && (
          <button type="button" className="danger" onClick={() => onDelete(item.id)}>
            Удалить
          </button>
        )}
      </div>

      {onUploadPoster && canEdit && (
        <input
          type="file"
          ref={fileRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && onUploadPoster(item.id, e.target.files[0])}
        />
      )}

      {showAddMovie && canEdit && (
        <div style={{ marginTop: '12px' }}>
          <Form
            onSubmit={async (fd) => {
              await onAddMovie(item.id, fd.get('movie_id'));
              setShowAddMovie(false);
              if (showListMovies) loadMovies();
            }}
            onCancel={() => setShowAddMovie(false)}
          >
            <label>
              Выберите фильм
              <select name="movie_id" required defaultValue="">
                <option value="" disabled>-- Выберите из списка --</option>
                {allMovies.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.year})
                  </option>
                ))}
              </select>
            </label>
          </Form>
        </div>
      )}

      {showListMovies && (
        <div className="list-movies">
          {listMovies.length === 0 ? (
            <p className="empty">Список пуст</p>
          ) : (
            <ul>
              {listMovies.map((m) => (
                <li key={m.id}>
                  <span>{m.title} ({m.year})</span>
                  {canEdit && (
                    <button
                      type="button"
                      className="danger"
                      onClick={async () => {
                        await onRemoveMovie(item.id, m.id);
                        loadMovies();
                      }}
                    >
                      Удалить
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}