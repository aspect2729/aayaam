export function IllustrativeNote({ children = "Demo data" }: { children?: string }) {
  return <p className="text-[12px] text-secondary">{children}</p>;
}
