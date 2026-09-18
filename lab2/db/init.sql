CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    director VARCHAR(200) NOT NULL,
    year INTEGER NOT NULL,
    poster_name VARCHAR(255),
    poster_path VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS list_movies (
    list_id INTEGER NOT NULL,
    movie_id INTEGER NOT NULL,

    PRIMARY KEY (list_id, movie_id),

    CONSTRAINT fk_list_movies_list
        FOREIGN KEY (list_id)
        REFERENCES lists(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_list_movies_movie
        FOREIGN KEY (movie_id)
        REFERENCES movies(id)
        ON DELETE CASCADE
);