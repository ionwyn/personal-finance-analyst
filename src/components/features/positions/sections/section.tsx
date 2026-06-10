export function Section({
  id,
  eyebrow,
  title,
  meta,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pos-section" id={"pos-sec-" + id}>
      <div className="pos-section-head">
        <div>
          <div className="pos-eyebrow">{eyebrow}</div>
          <div className="pos-section-title">{title}</div>
          {meta ? <div className="pos-section-meta">{meta}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
