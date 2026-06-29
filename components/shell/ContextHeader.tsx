import { ReactNode } from "react";

export function ContextHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ytx-context-header">
      <div className="min-w-0 flex-1">
        {breadcrumb ? <div className="ytx-breadcrumb">{breadcrumb}</div> : null}
        <h1 className="ytx-page-title">{title}</h1>
        {subtitle ? <p className="ytx-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ytx-context-actions">{actions}</div> : null}
    </header>
  );
}
