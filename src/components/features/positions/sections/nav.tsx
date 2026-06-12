import { SECTIONS } from "../format";

export function Nav({
  active,
  onJump,
  exclude,
}: {
  active: string;
  onJump: (id: string) => void;
  /** Section ids without content on this page (e.g. "intel" for funds). */
  exclude?: string[];
}) {
  return (
    <div className="pos-nav">
      {SECTIONS.filter(([k]) => !exclude?.includes(k)).map(([k, l]) => (
        <button
          key={k}
          type="button"
          className={"pos-nav-btn " + (active === k ? "on" : "")}
          onClick={() => onJump(k)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
