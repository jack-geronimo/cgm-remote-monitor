interface VerticalCursorLineProps {
  x: number;
  bbox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export function VerticalCursorLine({ x, bbox }: VerticalCursorLineProps) {
  return (
    <div
      className="absolute w-px bg-blue-500/50 pointer-events-none"
      style={{
        left: `${x}px`,
        top: `${bbox.top}px`,
        height: `${bbox.height}px`,
      }}
    />
  );
}
