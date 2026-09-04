export function validateMovieData(data) {
    const errors = {};

    if (!data.title || data.title.trim() === "") {
        errors.title = "Название обязательно";
    } else if (data.title.trim().length < 2) {
        errors.title = "Название должно быть не короче 2 символов";
    } else if (data.title.trim().length > 200) {
        errors.title = "Название должно быть не длиннее 200 символов";
    }

    if (!data.director || data.director.trim() === "") {
        errors.director = "Режиссёр обязателен";
    } else if (data.director.trim().length > 200) {
        errors.director = "Имя режиссёра должно быть не длиннее 200 символов";
    }

    if (!data.year || data.year === "") {
        errors.year = "Год обязателен";
    } else {
        const year = Number(data.year);

        if (isNaN(year)) {
            errors.year = "Год должен быть числом";
        } else if (year < 1888) {
            errors.year = "Год не может быть раньше 1888";
        } else if (year > new Date().getFullYear() + 5) {
            errors.year = "Год не может быть больше текущего + 5 лет";
        }
    }

    const allowedStatuses = ["planned", "watching", "watched", "dropped"];

    if (!data.status) {
        errors.status = "Статус обязателен";
    } else if (!allowedStatuses.includes(data.status)) {
        errors.status = "Недопустимый статус";
    }

    if (data.rating && data.rating !== "") {
        const rating = Number(data.rating);

        if (isNaN(rating)) {
            errors.rating = "Оценка должна быть числом";
        } else if (rating < 0 || rating > 10) {
            errors.rating = "Оценка должна быть от 0 до 10";
        }
    }

    if (data.watchDate && data.watchDate !== "") {
        const date = new Date(data.watchDate);

        if (isNaN(date.getTime())) {
            errors.watchDate = "Некорректная дата просмотра";
        }
    }

    if (data.plannedDate && data.plannedDate !== "") {
        const date = new Date(data.plannedDate);

        if (isNaN(date.getTime())) {
            errors.plannedDate = "Некорректная планируемая дата";
        }
    }

    if (data.description && data.description.length > 5000) {
        errors.description = "Описание должно быть не длиннее 5000 символов";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}