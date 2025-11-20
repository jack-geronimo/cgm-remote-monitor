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
  // No clamping - show line at actual data point position
  // This ensures edge points have visible cursor lines
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
