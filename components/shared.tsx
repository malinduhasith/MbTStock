import { Icon } from "./icon";

export function CardHeading({
  caption,
  title,
  action,
  onAction,
}: {
  caption: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="head">
      <div>
        <small>{caption}</small>
        <h2>{title}</h2>
      </div>
      {action ? (
        <button type="button" onClick={onAction}>
          {action} <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title = "Everything is accounted for",
  description = "Tools appear here after the alert threshold.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <Icon name="tools" />
      <strong>{title}</strong>
      <small>{description}</small>
    </div>
  );
}
