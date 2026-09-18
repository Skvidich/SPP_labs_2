export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function setFormSubmitting(form, submitting) {
  form.dataset.submitting = String(submitting);

  form.querySelectorAll('button').forEach(button => {
    button.disabled = submitting;
  });
}

export function validateMovie(movie) {
  if (!movie.title.trim()) {
    return 'Введите название фильма.';
  }

  if (!movie.director.trim()) {
    return 'Введите режиссёра.';
  }

  if (!Number.isInteger(movie.year) || movie.year < 1888) {
    return 'Год должен быть целым числом не меньше 1888.';
  }

  return null;
}

export function validateList(list) {
  if (!list.name.trim()) {
    return 'Введите название списка.';
  }

  if (list.description.length > 2000) {
    return 'Описание не должно превышать 2000 символов.';
  }

  return null;
}