import { useState } from 'react';
import { SOURCES, SOURCE_LABELS, SORT_FIELD_LABELS } from '../utils.js';

export default function Filters({ onApply, sourcesEnabled = true, sortFields = ['title', 'createdAt'] }) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [sortField, setSortField] = useState('title');
  const [sortDirection, setSortDirection] = useState('asc');

  const submit = () => {
    onApply({
      search: search.trim(),
      source,
      sortField,
      sortDirection,
    });
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') submit();
  };

  return (
    <div className="filters">
      <input
        className="filter-search"
        type="search"
        placeholder="Поиск…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleKey}
      />
      {sourcesEnabled && (
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Все источники</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
      )}
      <select value={sortField} onChange={(e) => setSortField(e.target.value)}>
        {sortFields.map((f) => (
          <option key={f} value={f}>
            Сортировка: {SORT_FIELD_LABELS[f] || f}
          </option>
        ))}
      </select>
      <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value)}>
        <option value="asc">По возрастанию</option>
        <option value="desc">По убыванию</option>
      </select>
      <button type="button" onClick={submit}>
        Применить
      </button>
    </div>
  );
}