export function EmptyPanelMessage({ text }: { text: string }) {
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: "var(--text-4)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      }}
    >
      {text}
    </div>
  );
}
