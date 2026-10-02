import React from 'react';

export function Form({ title, onSubmit, onCancel, children }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onSubmit(formData, () => e.target.reset());
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      {title && <h3>{title}</h3>}
      {children}
      <div className="form-buttons">
        <button type="submit">Сохранить</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Отмена</button>}
      </div>
    </form>
  );
}