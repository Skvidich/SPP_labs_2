import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../../uploads");

const dataFile = path.join(__dirname, "../../data/movies.json");

export async function getAllMovies() {
    const data = await fs.readFile(dataFile, "utf-8");

    return JSON.parse(data);
}

export async function saveMovies(movies) {
    const data = JSON.stringify(movies, null, 2);

    await fs.writeFile(dataFile, data, "utf-8");
}

export async function getMovieById(id) {
    const movies = await getAllMovies();

    return movies.find(movie => movie.id === id);
}

export async function getMoviesByStatus(status) {
    const movies = await getAllMovies();

    return movies.filter(movie => movie.status === status);
}

export async function updateMovie(id, updatedData) {
    const movies = await getAllMovies();

    const index = movies.findIndex(movie => movie.id === id);

    if (index === -1) {
        return null;
    }

    movies[index] = {
        ...movies[index],
        ...updatedData,
        id
    };

    await saveMovies(movies);

    return movies[index];
}

export async function deleteMovie(id) {
    const movies = await getAllMovies();

    const movieToDelete = movies.find(movie => movie.id === id);

    if (!movieToDelete) {
        return false;
    }

    const filteredMovies = movies.filter(movie => movie.id !== id);

    await saveMovies(filteredMovies);

    if (movieToDelete.poster) {
        const posterPath = path.join(uploadsDir, movieToDelete.poster);

        try {
            await fs.unlink(posterPath);
        } catch (err) {
            console.error(`Не удалось удалить файл постера: ${err.message}`);
        }
    }

    return true;
}

export async function searchMovies(filters = {}) {
    const movies = await getAllMovies();

    let filteredMovies = [...movies];

    if (filters.status) {
        filteredMovies = filteredMovies.filter(movie => movie.status === filters.status);
    }

    if (filters.title) {
        const titleQuery = filters.title.toLowerCase().trim();
        filteredMovies = filteredMovies.filter(movie =>
            movie.title.toLowerCase().includes(titleQuery)
        );
    }

    if (filters.director) {
        const directorQuery = filters.director.toLowerCase().trim();
        filteredMovies = filteredMovies.filter(movie =>
            movie.director.toLowerCase().includes(directorQuery)
        );
    }

    if (filters.year) {
        const year = Number(filters.year);
        if (!isNaN(year)) {
            filteredMovies = filteredMovies.filter(movie => movie.year === year);
        }
    }

    if (filters.minRating) {
        const minRating = Number(filters.minRating);
        if (!isNaN(minRating)) {
            filteredMovies = filteredMovies.filter(movie => movie.rating >= minRating);
        }
    }

    return filteredMovies;
}