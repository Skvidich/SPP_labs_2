export function sanitizeMovieData(data) {
    return {
        title: data.title ? data.title.trim() : "",
        director: data.director ? data.director.trim() : "",
        year: data.year ? data.year.trim() : "",
        status: data.status || "",
        rating: data.rating || "",
        watchDate: data.watchDate || "",
        plannedDate: data.plannedDate || "",
        description: data.description ? data.description.trim() : ""
    };
}