import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { upload } from "./config/upload.js";
import multer from "multer";
import session from "express-session";
import flash from "connect-flash";
import {
    getMovies,
    getMovie,
    createMovie,
    updateMovieData,
    removeMovie,
    setMoviePoster,
    removeMoviePoster
} from "./services/movieService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

app.use(session({
    secret: "cinelog-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60, // 1 час
        secure: false, 
        httpOnly: true
    }
}));

app.use(flash());
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});

app.use((req, res, next) => {
    res.locals.getStatusLabel = (status) => {
        const labels = {
            planned: 'Хочу посмотреть',
            watching: 'Смотрю',
            watched: 'Просмотрен',
            dropped: 'Брошен'
        };
        return labels[status] || status;
    };

    res.locals.getStatusIcon = (status) => {
        const icons = {
            planned: '📋',
            watching: '👀',
            watched: '✅',
            dropped: '❌'
        };
        return icons[status] || '🎬';
    };

    res.locals.getStatusWithIcon = (status) => {
        return `${res.locals.getStatusIcon(status)} ${res.locals.getStatusLabel(status)}`;
    };

    res.locals.formatDate = (dateString) => {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    res.locals.formatRating = (rating) => {
        if (!rating || rating === 0) return 'Не оценен';
        return `${rating}/10`;
    };

    res.locals.hasRating = (rating) => {
        return rating && rating > 0;
    };

    next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));


app.get("/", async (req, res) => {
    const filter = {
        status: req.query.status || "",
        title: req.query.title || "",
        director: req.query.director || "",
        year: req.query.year || "",
        minRating: req.query.minRating || ""
    };

    try {
        const movies = await getMovies(filter);

        res.render("index", {
            movies,
            currentStatus: filter.status,
            searchParams: {
                title: filter.title,
                director: filter.director,
                year: filter.year,
                minRating: filter.minRating
            },
            formData: {},
            errors: {}
        });
    } catch (err) {
        console.error("Ошибка при получении фильмов:", err);
        req.flash("error", "Не удалось загрузить список фильмов");
        res.render("index", {
            movies: [],
            currentStatus: filter.status,
            searchParams: {
                title: filter.title,
                director: filter.director,
                year: filter.year,
                minRating: filter.minRating
            },
            formData: {},
            errors: {}
        });
    }
});

app.get("/movies/:id", async (req, res) => {
    try {
        const movie = await getMovie(req.params.id);

        if (!movie) {
            return res.status(404).render("errors/404", {
                message: "Фильм не найден"
            });
        }

        res.render("movies/show", {
            movie
        });
    } catch (err) {
        console.error("Ошибка при получении фильма:", err);
        req.flash("error", "Не удалось загрузить информацию о фильме");
        res.redirect("/");
    }
});

app.get("/movies/:id/edit", async (req, res) => {
    try {
        const movie = await getMovie(req.params.id);

        if (!movie) {
            return res.status(404).render("errors/404", {
                message: "Фильм не найден"
            });
        }

        res.render("movies/edit", {
            movie,
            errors: {},
            formData: movie
        });
    } catch (err) {
        console.error("Ошибка при загрузке формы редактирования:", err);
        req.flash("error", "Не удалось загрузить форму редактирования");
        res.redirect("/");
    }
});

app.post("/movies/:id", async (req, res) => {
    try {
        const movie = await updateMovieData(req.params.id, req.body);

        if (!movie) {
            return res.status(404).render("errors/404", {
                message: "Фильм не найден"
            });
        }

        req.flash("success", `Фильм «${movie.title}» обновлён`);
        res.redirect(`/movies/${movie.id}`);
    } catch (err) {
        if (err.message === "Validation error") {
            const movie = await getMovie(req.params.id);

            if (!movie) {
                return res.status(404).render("errors/404", {
                    message: "Фильм не найден"
                });
            }

            return res.status(422).render("movies/edit", {
                movie: {
                    ...movie,
                    ...err.validationData
                },
                errors: err.validationErrors
            });
        }

        console.error("Ошибка при обновлении фильма:", err);
        req.flash("error", "Не удалось обновить фильм");
        res.redirect(`/movies/${req.params.id}/edit`);
    }
});

app.post("/movies/:id/poster", upload.single("poster"), async (req, res) => {
    try {
        if (!req.file) {
            req.flash("error", "Файл не загружен");
            return res.redirect(`/movies/${req.params.id}`);
        }

        const movie = await setMoviePoster(req.params.id, req.file);

        if (!movie) {
            return res.status(404).render("errors/404", {
                message: "Фильм не найден"
            });
        }

        req.flash("success", "Постер загружен");
        res.redirect(`/movies/${movie.id}`);
    } catch (err) {
        console.error("Ошибка при загрузке постера:", err);
        req.flash("error", "Не удалось загрузить постер");
        res.redirect(`/movies/${req.params.id}`);
    }
});

app.post("/movies/:id/poster/delete", async (req, res) => {
    try {
        const movie = await removeMoviePoster(req.params.id);

        if (!movie) {
            return res.status(404).render("errors/404", {
                message: "Фильм не найден"
            });
        }

        req.flash("success", "Постер удалён");
        res.redirect(`/movies/${movie.id}`);
    } catch (err) {
        console.error("Ошибка при удалении постера:", err);
        req.flash("error", "Не удалось удалить постер");
        res.redirect(`/movies/${req.params.id}`);
    }
});

app.post("/movies/:id/delete", async (req, res) => {
    try {
        const movie = await removeMovie(req.params.id);

        if (!movie) {
            return res.status(404).render("errors/404", {
                message: "Фильм не найден"
            });
        }

        req.flash("success", `Фильм «${movie.title}» удалён`);
        res.redirect("/");
    } catch (err) {
        console.error("Ошибка при удалении фильма:", err);
        req.flash("error", "Не удалось удалить фильм");
        res.redirect("/");
    }
});

app.post("/movies", async (req, res) => {
    try {
        const movie = await createMovie(req.body);

        req.flash("success", `Фильм «${movie.title}» добавлен`);
        res.redirect("/");
    } catch (err) {
        if (err.message === "Validation error") {
            const movies = await getMovies();

            return res.status(422).render("index", {
                movies,
                errors: err.validationErrors,
                formData: err.validationData,
                currentStatus: "",
                searchParams: {
                    title: "",
                    director: "",
                    year: "",
                    minRating: ""
                }
            });
        }

        console.error("Ошибка при создании фильма:", err);
        req.flash("error", "Не удалось добавить фильм");
        
        const movies = await getMovies();
        
        return res.status(500).render("index", {
            movies,
            errors: {},
            formData: req.body,
            currentStatus: "",
            searchParams: {
                title: "",
                director: "",
                year: "",
                minRating: ""
            }
        });
    }
});

app.use((req, res) => {
    res.status(404).render("errors/404", {
        message: "Страница не существует"
    });
});

app.use((err, req, res, next) => {
    console.error("Ошибка сервера:", err);

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            req.flash("error", "Файл слишком большой. Максимальный размер 5MB");
            return res.redirect(req.headers.referer || '/');
        }
        req.flash("error", `Ошибка загрузки: ${err.message}`);
        return res.redirect(req.headers.referer || '/');
    }

    if (err.message === "Разрешены только изображения") {
        req.flash("error", "Можно загружать только изображения (JPEG, PNG, WebP, GIF)");
        return res.redirect(req.headers.referer || '/');
    }

    res.status(500).render("errors/500", {
        message: "Внутренняя ошибка сервера"
    });
});

app.listen(port, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${port}`);
    console.log(`📝 Откройте браузер и перейдите по адресу http://localhost:${port}`);
});