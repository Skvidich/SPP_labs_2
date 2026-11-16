import { NavLink, Route, Routes } from 'react-router-dom';
import ArtistsPage from './pages/ArtistsPage.jsx';
import ArtistPage from './pages/ArtistPage.jsx';
import TracksPage from './pages/TracksPage.jsx';
import CollectionsPage from './pages/CollectionsPage.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Music Catalog</h1>
        <nav className="app-nav">
          <NavLink to="/" end>
            Исполнители
          </NavLink>
          <NavLink to="/tracks">Треки</NavLink>
          <NavLink to="/collections">Подборки</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<ArtistsPage />} />
          <Route path="/artists/:id" element={<ArtistPage />} />
          <Route path="/tracks" element={<TracksPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function NotFound() {
  return <div className="notice">Страница не найдена</div>;
}