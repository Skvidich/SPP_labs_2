import { hideMessage } from './ui.js';

import {
  initMovies,
  loadMovies
} from './movies.js';

import {
  initLists,
  loadLists
} from './lists.js';


/* =========================
   ИНИЦИАЛИЗАЦИЯ
   ========================= */

async function initialize() {
  hideMessage();

  initMovies();
  initLists();

  await Promise.all([
    loadMovies(),
    loadLists()
  ]);
}


/* =========================
   СВЯЗЬ МОДУЛЕЙ
   ========================= */

/*
  После удаления фильма обновляем списки,
  потому что фильм мог находиться внутри одного
  или нескольких списков.
*/
window.addEventListener(
  'movies:changed',
  async () => {
    await loadLists();
  }
);


/* =========================
   ЗАПУСК ПРИЛОЖЕНИЯ
   ========================= */

initialize();

