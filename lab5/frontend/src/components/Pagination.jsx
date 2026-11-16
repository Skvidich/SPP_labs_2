import { PAGE_SIZES } from '../config.js';

export default function Pagination({ offset, limit, hasItems, onPageChange }) {
  const page = Math.floor(offset / limit) + 1;
  const hasPrev = offset > 0;
  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  return (
    <div className="pagination">
      <div className="pagination-info">
        Страница {page}
        {hasItems ? '' : ' — данных больше нет'}
      </div>
      <div className="pagination-controls">
        <label className="page-size">
          Показывать:
          <select value={limit} onChange={(e) => onPageChange(0, Number(e.target.value))}>
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button disabled={!hasPrev} onClick={() => onPageChange(prevOffset, limit)}>
          ← Назад
        </button>
        <button disabled={!hasItems} onClick={() => onPageChange(nextOffset, limit)}>
          Вперёд →
        </button>
      </div>
    </div>
  );
}