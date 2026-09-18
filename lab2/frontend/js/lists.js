import { apiRequest } from './api.js';
import { showMessage } from './ui.js';
import {
  escapeHtml,
  setFormSubmitting,
  validateList
} from './utils.js';

const listForm = document.getElementById('list-form');

const listNameInput =
  document.getElementById('list-name');

const listDescriptionInput =
  document.getElementById('list-description');

const listsListElement =
  document.getElementById('lists-list');

const showListFormButton =
  document.getElementById('show-list-form-button');

const cancelListFormButton =
  document.getElementById('cancel-list-form-button');


/* =========================
   ЗАГРУЗКА СПИСКОВ
   ========================= */

export async function loadLists() {
  try {
    const lists = await apiRequest('/lists');

    if (!Array.isArray(lists)) {
      throw new Error(
        'Сервер вернул некорректный формат списка списков.'
      );
    }

    renderLists(lists);
  } catch (error) {
    listsListElement.innerHTML =
      '<p class="error">Не удалось загрузить списки.</p>';

    showMessage(error.message, 'error');
  }
}


/* =========================
   ОТОБРАЖЕНИЕ СПИСКОВ
   ========================= */

export function renderLists(lists) {
  if (lists.length === 0) {
    listsListElement.innerHTML =
      '<p class="empty">Списков пока нет.</p>';

    return;
  }

  listsListElement.innerHTML = lists
    .map(list => {
      const listId = escapeHtml(list.id);

      return `
        <article
          class="card"
          data-list-id="${listId}"
        >
          <h3>
            ${escapeHtml(list.name)}
          </h3>

          <p>
            ${
              list.description
                ? escapeHtml(list.description)
                : 'Без описания'
            }
          </p>

          <div class="card-actions">
            <button
              type="button"
              data-action="view-list-movies"
              data-id="${listId}"
            >
              Фильмы списка
            </button>

            <button
              type="button"
              data-action="add-movie-to-list"
              data-id="${listId}"
            >
              Добавить фильм
            </button>

            <button
              type="button"
              data-action="edit-list"
              data-id="${listId}"
            >
              Изменить
            </button>

            <button
              type="button"
              class="danger"
              data-action="delete-list"
              data-id="${listId}"
            >
              Удалить
            </button>
          </div>

          <div
            id="add-movie-to-list-${listId}"
            class="card-edit-form hidden"
          ></div>

          <div
            id="list-movies-${listId}"
            class="list-movies"
          ></div>
        </article>
      `;
    })
    .join('');
}


/* =========================
   РЕДАКТИРОВАНИЕ СПИСКА
   ========================= */

function showListEditForm(list) {
  const card = document.querySelector(
    `[data-list-id="${escapeHtml(list.id)}"]`
  );

  if (!card) {
    return;
  }

  const listId = escapeHtml(list.id);

  card.classList.add('editing');

  card.innerHTML = `
    <h3>Редактирование списка</h3>

    <form
      class="card-edit-form"
      data-list-edit-form="${listId}"
    >
      <label>
        Название
        <input
          type="text"
          name="name"
          maxlength="200"
          value="${escapeHtml(list.name)}"
          required
        >
      </label>

      <label>
        Описание
        <textarea
          name="description"
          maxlength="2000"
          rows="4"
        >${escapeHtml(list.description ?? '')}</textarea>
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
          data-action="cancel-edit-list"
        >
          Отмена
        </button>
      </div>
    </form>
  `;
}

async function editList(id) {
  try {
    const list = await apiRequest(`/lists/${id}`);

    if (!list || typeof list !== 'object') {
      throw new Error(
        'Сервер вернул некорректные данные списка.'
      );
    }

    showListEditForm(list);
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function saveListEdit(id, form) {
  if (form.dataset.submitting === 'true') {
    return;
  }

  const formData = new FormData(form);

  const list = {
    name: String(formData.get('name') ?? '').trim(),
    description: String(
      formData.get('description') ?? ''
    ).trim()
  };

  const validationError = validateList(list);

  if (validationError) {
    showMessage(validationError, 'error');
    return;
  }

  setFormSubmitting(form, true);

  try {
    await apiRequest(`/lists/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(list)
    });

    showMessage('Список изменён');

    await loadLists();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    setFormSubmitting(form, false);
  }
}


/* =========================
   УДАЛЕНИЕ СПИСКА
   ========================= */

async function deleteList(id) {
  const confirmed = confirm('Удалить этот список?');

  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(`/lists/${id}`, {
      method: 'DELETE'
    });

    showMessage('Список удалён');

    await loadLists();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}


/* =========================
   ДОБАВЛЕНИЕ ФИЛЬМА В СПИСОК
   ========================= */

async function showAddMovieToListForm(listId) {
  const container = document.getElementById(
    `add-movie-to-list-${listId}`
  );

  if (!container) {
    return;
  }

  try {
    const movies = await apiRequest('/movies');

    if (!Array.isArray(movies)) {
      throw new Error(
        'Сервер вернул некорректный список фильмов.'
      );
    }

    if (movies.length === 0) {
      container.innerHTML = `
        <p>Сначала создайте хотя бы один фильм.</p>

        <button
          type="button"
          class="secondary"
          data-action="cancel-add-movie"
        >
          Закрыть
        </button>
      `;

      container.classList.remove('hidden');

      return;
    }

    container.innerHTML = `
      <form data-add-movie-form="${escapeHtml(listId)}">
        <label>
          Фильм

          <select
            name="movie_id"
            required
          >
            <option value="">
              Выберите фильм
            </option>

            ${movies
              .map(movie => `
                <option value="${escapeHtml(movie.id)}">
                  ${escapeHtml(movie.title)}
                  (${escapeHtml(movie.year)})
                </option>
              `)
              .join('')}
          </select>
        </label>

        <div class="form-buttons">
          <button
            type="submit"
            class="success"
          >
            Добавить
          </button>

          <button
            type="button"
            class="secondary"
            data-action="cancel-add-movie"
          >
            Отмена
          </button>
        </div>
      </form>
    `;

    container.classList.remove('hidden');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function addMovieToList(listId, form) {
  if (form.dataset.submitting === 'true') {
    return;
  }

  const formData = new FormData(form);

  const movieId = Number(
    formData.get('movie_id')
  );

  if (!Number.isInteger(movieId) || movieId <= 0) {
    showMessage('Выберите фильм', 'error');
    return;
  }

  setFormSubmitting(form, true);

  try {
    await apiRequest(
      `/lists/${listId}/movies/${movieId}`,
      {
        method: 'POST'
      }
    );

    showMessage('Фильм добавлен в список');

    const container = document.getElementById(
      `add-movie-to-list-${listId}`
    );

    if (container) {
      container.classList.add('hidden');
      container.innerHTML = '';
    }

    await loadListMovies(listId);
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    setFormSubmitting(form, false);
  }
}


/* =========================
   ФИЛЬМЫ СПИСКА
   ========================= */

export async function loadListMovies(listId) {
  const container = document.getElementById(
    `list-movies-${listId}`
  );

  if (!container) {
    return;
  }

  try {
    const movies = await apiRequest(
      `/lists/${listId}/movies`
    );

    if (!Array.isArray(movies)) {
      throw new Error(
        'Сервер вернул некорректный список фильмов.'
      );
    }

    if (movies.length === 0) {
      container.innerHTML =
        '<p>В списке нет фильмов.</p>';

      return;
    }

    container.innerHTML = `
      <strong>Фильмы списка:</strong>

      <ul>
        ${movies
          .map(movie => `
            <li>
              ${escapeHtml(movie.title)}
              (${escapeHtml(movie.year)})

              <button
                type="button"
                class="danger"
                data-remove-movie="${escapeHtml(movie.id)}"
                data-list-id="${escapeHtml(listId)}"
              >
                Убрать
              </button>
            </li>
          `)
          .join('')}
      </ul>
    `;
  } catch (error) {
    showMessage(error.message, 'error');
  }
}


/* =========================
   УДАЛЕНИЕ ФИЛЬМА ИЗ СПИСКА
   ========================= */

async function removeMovieFromList(listId, movieId) {
  const confirmed = confirm(
    'Убрать этот фильм из списка?'
  );

  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(
      `/lists/${listId}/movies/${movieId}`,
      {
        method: 'DELETE'
      }
    );

    showMessage('Фильм удалён из списка');

    await loadListMovies(listId);
  } catch (error) {
    showMessage(error.message, 'error');
  }
}


/* =========================
   СОЗДАНИЕ СПИСКА
   ========================= */

async function handleCreateList(event) {
  event.preventDefault();

  if (listForm.dataset.submitting === 'true') {
    return;
  }

  const list = {
    name: listNameInput.value.trim(),
    description: listDescriptionInput.value.trim()
  };

  const validationError = validateList(list);

  if (validationError) {
    showMessage(validationError, 'error');
    return;
  }

  setFormSubmitting(listForm, true);

  try {
    await apiRequest('/lists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(list)
    });

    showMessage('Список создан');

    listForm.reset();
    listForm.classList.add('hidden');

    await loadLists();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    setFormSubmitting(listForm, false);
  }
}


/* =========================
   ОБРАБОТКА ФОРМЫ СОЗДАНИЯ
   ========================= */

function showCreateListForm() {
  listForm.classList.remove('hidden');
  listNameInput.focus();
}

function cancelCreateListForm() {
  listForm.reset();
  listForm.classList.add('hidden');
}


/* =========================
   ОБРАБОТКА КНОПОК
   ========================= */

async function handleListClick(event) {
  const removeMovieButton =
    event.target.closest('[data-remove-movie]');

  if (removeMovieButton) {
    const movieId =
      removeMovieButton.dataset.removeMovie;

    const listId =
      removeMovieButton.dataset.listId;

    if (movieId && listId) {
      await removeMovieFromList(listId, movieId);
    }

    return;
  }

  const button = event.target.closest('button');

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const id = button.dataset.id;

  switch (action) {
    case 'edit-list':
      if (id) {
        await editList(id);
      }
      break;

    case 'delete-list':
      if (id) {
        await deleteList(id);
      }
      break;

    case 'view-list-movies':
      if (id) {
        await loadListMovies(id);
      }
      break;

    case 'add-movie-to-list':
      if (id) {
        await showAddMovieToListForm(id);
      }
      break;

    case 'cancel-add-movie': {
      const card =
        button.closest('[data-list-id]');

      if (!card) {
        break;
      }

      const listId = card.dataset.listId;

      const container = document.getElementById(
        `add-movie-to-list-${listId}`
      );

      if (container) {
        container.classList.add('hidden');
        container.innerHTML = '';
      }

      break;
    }

    case 'cancel-edit-list':
      await loadLists();
      break;

    default:
      break;
  }
}


/* =========================
   ОБРАБОТКА ОТПРАВКИ ФОРМ
   ========================= */

async function handleListSubmit(event) {
  const editForm = event.target.closest(
    '[data-list-edit-form]'
  );

  if (editForm) {
    event.preventDefault();

    const id = editForm.dataset.listEditForm;

    if (id) {
      await saveListEdit(id, editForm);
    }

    return;
  }

  const addMovieForm = event.target.closest(
    '[data-add-movie-form]'
  );

  if (addMovieForm) {
    event.preventDefault();

    const listId = addMovieForm.dataset.addMovieForm;

    if (listId) {
      await addMovieToList(
        listId,
        addMovieForm
      );
    }
  }
}


/* =========================
   ИНИЦИАЛИЗАЦИЯ
   ========================= */

export function initLists() {
  showListFormButton.addEventListener(
    'click',
    showCreateListForm
  );

  cancelListFormButton.addEventListener(
    'click',
    cancelCreateListForm
  );

  listForm.addEventListener(
    'submit',
    handleCreateList
  );

  listsListElement.addEventListener(
    'click',
    handleListClick
  );

  listsListElement.addEventListener(
    'submit',
    handleListSubmit
  );
}