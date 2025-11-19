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
  // DEBUG: Log actual line position
  if (Math.random() < 0.05) {
    console.log('LINE RENDERING:', {
      lineX: x.toFixed(1),
      bboxLeft: bbox.left.toFixed(1),
      bboxWidth: bbox.width.toFixed(1),
    });
  }

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
