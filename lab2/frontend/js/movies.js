import { apiRequest } from './api.js';
import { showMessage } from './ui.js';
import {
  escapeHtml,
  setFormSubmitting,
  validateMovie
} from './utils.js';

const movieForm = document.getElementById('movie-form');
const movieTitleInput = document.getElementById('movie-title');
const movieDirectorInput =
  document.getElementById('movie-director');
const movieYearInput =
  document.getElementById('movie-year');

const moviesListElement =
  document.getElementById('movies-list');

const showMovieFormButton =
  document.getElementById('show-movie-form-button');

const cancelMovieFormButton =
  document.getElementById('cancel-movie-form-button');


/* =========================
   ЗАГРУЗКА ФИЛЬМОВ
   ========================= */

export async function loadMovies() {
  try {
    const movies = await apiRequest('/movies');

    if (!Array.isArray(movies)) {
      throw new Error(
        'Сервер вернул некорректный формат списка фильмов.'
      );
    }

    renderMovies(movies);
  } catch (error) {
    moviesListElement.innerHTML =
      '<p class="error">Не удалось загрузить фильмы.</p>';

    showMessage(error.message, 'error');
  }
}


/* =========================
   ОТОБРАЖЕНИЕ ФИЛЬМОВ
   ========================= */

export function renderMovies(movies) {
  if (movies.length === 0) {
    moviesListElement.innerHTML =
      '<p class="empty">Фильмов пока нет.</p>';

    return;
  }

  moviesListElement.innerHTML = movies
    .map(movie => {
      const movieId = escapeHtml(movie.id);

      return `
        <article
          class="card"
          data-movie-id="${movieId}"
        >
          ${
            movie.poster_path
              ? `
                <img
                  class="poster"
                  src="${escapeHtml(movie.poster_path)}"
                  alt="Постер фильма"
                >
              `
              : ''
          }

          <h3>
            ${escapeHtml(movie.title)}
          </h3>

          <p>
            <strong>Режиссёр:</strong>
            ${escapeHtml(movie.director)}
          </p>

          <p>
            <strong>Год:</strong>
            ${escapeHtml(movie.year)}
          </p>

          <div class="card-actions">
            <button
              type="button"
              data-action="edit-movie"
              data-id="${movieId}"
            >
              Изменить
            </button>

            <button
              type="button"
              class="danger"
              data-action="delete-movie"
              data-id="${movieId}"
            >
              Удалить
            </button>

            <button
              type="button"
              data-action="upload-poster"
              data-id="${movieId}"
            >
              Загрузить постер
            </button>
          </div>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            data-poster-input="${movieId}"
            class="hidden"
          >
        </article>
      `;
    })
    .join('');
}


/* =========================
   РЕДАКТИРОВАНИЕ ФИЛЬМА
   ========================= */

function showMovieEditForm(movie) {
  const card = document.querySelector(
    `[data-movie-id="${escapeHtml(movie.id)}"]`
  );

  if (!card) {
    return;
  }

  const movieId = escapeHtml(movie.id);

  card.classList.add('editing');

  card.innerHTML = `
    <h3>Редактирование фильма</h3>

    <form
      class="card-edit-form"
      data-movie-edit-form="${movieId}"
    >
      <label>
        Название
        <input
          type="text"
          name="title"
          maxlength="200"
          value="${escapeHtml(movie.title)}"
          required
        >
      </label>

      <label>
        Режиссёр
        <input
          type="text"
          name="director"
          maxlength="200"
          value="${escapeHtml(movie.director)}"
          required
        >
      </label>

      <label>
        Год
        <input
          type="number"
          name="year"
          min="1888"
          step="1"
          value="${escapeHtml(movie.year)}"
          required
        >
      </label>

      <div class="form-buttons">
        <button
          type="submit"
          class="success"
        >
          Сохранить
        </button>

        <button
          type="button"
          class="secondary"
          data-action="cancel-edit-movie"
        >
          Отмена
        </button>
      </div>
    </form>
  `;
}

async function editMovie(id) {
  try {
    const movie = await apiRequest(`/movies/${id}`);

    if (!movie || typeof movie !== 'object') {
      throw new Error(
        'Сервер вернул некорректные данные о фильме.'
      );
    }

    showMovieEditForm(movie);
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function saveMovieEdit(id, form) {
  if (form.dataset.submitting === 'true') {
    return;
  }

  const formData = new FormData(form);

  const movie = {
    title: String(formData.get('title') ?? '').trim(),
    director: String(formData.get('director') ?? '').trim(),
    year: Number(formData.get('year'))
  };

  const validationError = validateMovie(movie);

  if (validationError) {
    showMessage(validationError, 'error');
    return;
  }

  setFormSubmitting(form, true);

  try {
    await apiRequest(`/movies/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(movie)
    });

    showMessage('Фильм изменён');

    await loadMovies();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    setFormSubmitting(form, false);
  }
}


/* =========================
   УДАЛЕНИЕ ФИЛЬМА
   ========================= */

async function deleteMovie(id) {
  const confirmed = confirm('Удалить этот фильм?');

  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(`/movies/${id}`, {
      method: 'DELETE'
    });

    showMessage('Фильм удалён');

    await loadMovies();

    /*
      После удаления фильма содержимое списков
      потенциально тоже может измениться.
      Здесь временно отправляем событие,
      чтобы app.js мог обновить списки без
      прямой зависимости movies.js → lists.js.
    */
    window.dispatchEvent(
      new CustomEvent('movies:changed')
    );
  } catch (error) {
    showMessage(error.message, 'error');
  }
}


/* =========================
   ЗАГРУЗКА ПОСТЕРА
   ========================= */

async function uploadPoster(movieId, file) {
  if (!(file instanceof File)) {
    return;
  }

  const formData = new FormData();
  formData.append('poster', file);

  try {
    await apiRequest(`/movies/${movieId}/poster`, {
      method: 'POST',
      body: formData
    });

    showMessage('Постер загружен');

    await loadMovies();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}


/* =========================
   СОЗДАНИЕ ФИЛЬМА
   ========================= */

async function handleCreateMovie(event) {
  event.preventDefault();

  if (movieForm.dataset.submitting === 'true') {
    return;
  }

  const movie = {
    title: movieTitleInput.value.trim(),
    director: movieDirectorInput.value.trim(),
    year: Number(movieYearInput.value)
  };

  const validationError = validateMovie(movie);

  if (validationError) {
    showMessage(validationError, 'error');
    return;
  }

  setFormSubmitting(movieForm, true);

  try {
    await apiRequest('/movies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(movie)
    });

    showMessage('Фильм создан');

    movieForm.reset();
    movieForm.classList.add('hidden');

    await loadMovies();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    setFormSubmitting(movieForm, false);
  }
}


/* =========================
   ОБРАБОТКА СОЗДАНИЯ
   ========================= */

function showCreateMovieForm() {
  movieForm.classList.remove('hidden');
  movieTitleInput.focus();
}

function cancelCreateMovieForm() {
  movieForm.reset();
  movieForm.classList.add('hidden');
}


/* =========================
   ОБРАБОТКА ФИЛЬМОВ
   ========================= */

async function handleMovieClick(event) {
  const button = event.target.closest('button');

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (!id) {
    return;
  }

  switch (action) {
    case 'edit-movie':
      await editMovie(id);
      break;

    case 'delete-movie':
      await deleteMovie(id);
      break;

    case 'upload-poster': {
      const input = document.querySelector(
        `[data-poster-input="${escapeHtml(id)}"]`
      );

      if (input) {
        input.click();
      }

      break;
    }

    case 'cancel-edit-movie':
      await loadMovies();
      break;

    default:
      break;
  }
}

async function handleMovieSubmit(event) {
  const form = event.target.closest(
    '[data-movie-edit-form]'
  );

  if (!form) {
    return;
  }

  event.preventDefault();

  const id = form.dataset.movieEditForm;

  if (!id) {
    return;
  }

  await saveMovieEdit(id, form);
}

async function handlePosterChange(event) {
  const input = event.target;

  if (!input.matches('[data-poster-input]')) {
    return;
  }

  const file = input.files?.[0];

  if (!file) {
    return;
  }

  const movieId = input.dataset.posterInput;

  if (!movieId) {
    return;
  }

  await uploadPoster(movieId, file);

  input.value = '';
}


/* =========================
   ИНИЦИАЛИЗАЦИЯ
   ========================= */

export function initMovies() {
  showMovieFormButton.addEventListener(
    'click',
    showCreateMovieForm
  );

  cancelMovieFormButton.addEventListener(
    'click',
    cancelCreateMovieForm
  );

  movieForm.addEventListener(
    'submit',
    handleCreateMovie
  );

  moviesListElement.addEventListener(
    'click',
    handleMovieClick
  );

  moviesListElement.addEventListener(
    'submit',
    handleMovieSubmit
  );

  moviesListElement.addEventListener(
    'change',
    handlePosterChange
  );
}
