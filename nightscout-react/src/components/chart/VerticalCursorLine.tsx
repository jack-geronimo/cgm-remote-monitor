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
  // Clamp line position to bbox boundaries
  const clampedX = Math.max(bbox.left, Math.min(x, bbox.left + bbox.width));

  return (
    <div
      className="absolute w-px bg-blue-500/50 pointer-events-none"
      style={{
        left: `${clampedX}px`,
        top: `${bbox.top}px`,
        height: `${bbox.height}px`,
      }}
    />
  );
}
