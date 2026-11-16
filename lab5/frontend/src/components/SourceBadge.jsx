import { SOURCE_LABELS } from '../utils.js';

export default function SourceBadge({ source }) {
  return <span className={`badge badge-source badge-${source}`}>{SOURCE_LABELS[source] || source}</span>;
}