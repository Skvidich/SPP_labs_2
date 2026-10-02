import React from 'react';

export function Notification({ message, type }) {
  if (!message) return null;

  return (
    <section className={`message ${type}`} role="status" aria-live="polite">
      {message}
    </section>
  );
}