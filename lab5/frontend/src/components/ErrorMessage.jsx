export default function ErrorMessage({ error, title = 'Ошибка при загрузке данных' }) {
  if (!error) return null;
  const message = error.graphQLErrors?.length
    ? error.graphQLErrors.map((e) => e.message).join('; ')
    : error.message;
  return (
    <div className="notice notice-error">
      <strong>{title}:</strong> {message}
    </div>
  );
}