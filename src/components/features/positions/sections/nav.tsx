import { SECTIONS } from "../format";

export function Nav({ active, onJump }: { active: string; onJump: (id: string) => void }) {
  return (
    <div className="pos-nav">
      {SECTIONS.map(([k, l]) => (
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
