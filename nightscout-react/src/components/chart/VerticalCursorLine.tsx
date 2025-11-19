interface VerticalCursorLineProps {
  x: number;
  height: number;
}

export function VerticalCursorLine({ x, height }: VerticalCursorLineProps) {
  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-blue-500/50 pointer-events-none"
      style={{
        left: `${x}px`,
        height: `${height}px`,
      }}
    />
  );
}
