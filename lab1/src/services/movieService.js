import {
    getAllMovies,
    getMovieById,
    getMoviesByStatus,
    saveMovies,
    updateMovie,
    deleteMovie,
    searchMovies
} from "../repositories/movieRepository.js";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMovieData } from "../validators/movieValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "../../uploads");

export async function getMovie(id) {
    return getMovieById(id);
}

export async function createMovie(movieData) {
    const validation = validateMovieData(movieData);

    if (!validation.isValid) {
        const error = new Error("Validation error");
        error.validationErrors = validation.errors;
        error.validationData = movieData;
        throw error;
    }

    const movies = await getAllMovies();

    const movie = {
        id: crypto.randomUUID(),
        title: movieData.title.trim(),
        director: movieData.director.trim(),
        year: Number(movieData.year),
        status: movieData.status,
        rating: movieData.rating ? Number(movieData.rating) : 0,
        watchDate: movieData.watchDate || null,
        plannedDate: movieData.plannedDate || null,
        description: movieData.description.trim()
    };

    movies.push(movie);

    await saveMovies(movies);

    return movie;
}

export async function getMovies(filter = {}) {
    if (filter.status || filter.title || filter.director || filter.year || filter.minRating) {
        return searchMovies(filter);
    }

    return getAllMovies();
}

export async function updateMovieData(id, movieData) {
    const validation = validateMovieData(movieData);

    if (!validation.isValid) {
        const error = new Error("Validation error");
        error.validationErrors = validation.errors;
        error.validationData = movieData;
        throw error;
    }

    const movie = await getMovieById(id);

    if (!movie) {
        return null;
    }

    const updatedMovie = {
        title: movieData.title.trim(),
        director: movieData.director.trim(),
        year: Number(movieData.year),
        status: movieData.status,
        rating: movieData.rating ? Number(movieData.rating) : 0,
        watchDate: movieData.watchDate || null,
        plannedDate: movieData.plannedDate || null,
        description: movieData.description.trim()
    };

    return updateMovie(id, updatedMovie);
}

export async function removeMovie(id) {
    const movie = await getMovieById(id);

    if (!movie) {
        return null;
    }

    await deleteMovie(id);

    return movie;
}

export async function setMoviePoster(id, posterFile) {
    const movie = await getMovieById(id);

    if (!movie) {
        return null;
    }

    if (movie.poster) {
        const oldPosterPath = path.join(uploadsDir, movie.poster);

        try {
            await fs.unlink(oldPosterPath);
        } catch (err) {
            console.error(`Не удалось удалить старый постер: ${err.message}`);
        }
    }

    const updatedMovie = {
        ...movie,
        poster: posterFile.filename
    };

    return updateMovie(id, updatedMovie);
}

export async function removeMoviePoster(id) {
    const movie = await getMovieById(id);

    if (!movie) {
        return null;
    }

    if (movie.poster) {
        const posterPath = path.join(uploadsDir, movie.poster);

        try {
            await fs.unlink(posterPath);
        } catch (err) {
            console.error(`Не удалось удалить файл постера: ${err.message}`);
        }
    }

    const updatedMovie = {
        ...movie,
        poster: null
    };

    return updateMovie(id, updatedMovie);
}