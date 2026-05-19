import type { CSSProperties, ReactNode } from "react";

export function Panel({
  title,
  meta,
  actions,
  flush = false,
  bodyStyle,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  bodyStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        {actions ?? (meta ? <div className="panel-meta">{meta}</div> : null)}
      </div>
      <div className={`panel-body${flush ? " flush" : ""}`} style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}
