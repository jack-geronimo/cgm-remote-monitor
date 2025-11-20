import uPlot from 'uplot';
import type { Treatment, BgEntry } from '../../types';

/**
 * uPlot plugin to render treatment markers (insulin, carbs) on the chart
 * Displays treatments as data points at the BG level (like legacy Nightscout)
 */
export function createTreatmentMarkersPlugin(
  treatments: Treatment[],
  bgEntries: BgEntry[]
): uPlot.Plugin {
  // Debug: Log treatment count when plugin is created
  console.log('💉 Treatment markers plugin created:', {
    totalTreatments: treatments.length,
    withInsulin: treatments.filter(t => t.insulin && t.insulin > 0).length,
    withCarbs: treatments.filter(t => t.carbs && t.carbs > 0).length,
    bgEntries: bgEntries.length,
  });

  // Match treatments with BG entries to find Y position
  const treatmentWithBg = treatments.map(treatment => {
    // Find closest BG entry by timestamp
    let closestEntry = bgEntries[0];
    let minDiff = Math.abs((bgEntries[0]?.mills || bgEntries[0]?.date || 0) - treatment.mills);

    for (const entry of bgEntries) {
      const entryTime = entry.mills || entry.date;
      const diff = Math.abs(entryTime - treatment.mills);
      if (diff < minDiff) {
        minDiff = diff;
        closestEntry = entry;
      }
    }

    return {
      treatment,
      bgValue: closestEntry?.sgv || 100, // Fallback to 100 if no BG found
    };
  });

  return {
    hooks: {
      draw: [(u) => {
        const { ctx, bbox } = u;
        const { left, top, width, height } = bbox;

        ctx.save();

        // Clip to chart bounds
        ctx.beginPath();
        ctx.rect(left, top, width, height);
        ctx.clip();

        // Count how many treatments we actually draw
        let drawnCount = 0;

        // Draw each treatment at the BG level
        treatmentWithBg.forEach(({ treatment, bgValue }) => {
          const hasInsulin = treatment.insulin && treatment.insulin > 0;
          const hasCarbs = treatment.carbs && treatment.carbs > 0;

          if (!hasInsulin && !hasCarbs) return;

          // Get X position from timestamp
          const x = u.valToPos(treatment.mills / 1000, 'x', true);

          // Skip if outside visible area
          if (x < left || x > left + width) return;

          // Get Y position from BG value
          const y = u.valToPos(bgValue, 'y', true);

          drawnCount++;

          // Draw treatment marker at BG position
          if (hasInsulin && hasCarbs) {
            // Both: Triangle marker with border
            drawCombinedMarker(ctx, x, y, treatment.insulin!, treatment.carbs!);
          } else if (hasInsulin) {
            // Insulin only: Filled triangle pointing down
            drawInsulinMarker(ctx, x, y, treatment.insulin!);
          } else if (hasCarbs) {
            // Carbs only: Filled circle
            drawCarbsMarker(ctx, x, y, treatment.carbs!);
          }
        });

        // Debug: Log how many were actually drawn
        if (drawnCount > 0) {
          console.log(`💉 Drew ${drawnCount} treatment markers in viewport`);
        }

        ctx.restore();
      }],
    },
  };
}

/**
 * Draw insulin marker as filled triangle at BG position
 */
function drawInsulinMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  insulin: number
) {
  const size = 8; // Triangle size

  // Draw filled triangle pointing down
  ctx.fillStyle = '#3b82f6'; // Blue for insulin
  ctx.strokeStyle = '#1e40af';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(x, y + size); // Bottom point
  ctx.lineTo(x - size, y - size); // Top left
  ctx.lineTo(x + size, y - size); // Top right
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw insulin amount text below
  ctx.fillStyle = '#3b82f6';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(insulin.toFixed(1) + 'U', x, y + size + 2);
}

/**
 * Draw carbs marker as filled circle at BG position
 */
function drawCarbsMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  carbs: number
) {
  const radius = 7;

  // Draw filled circle
  ctx.fillStyle = '#f59e0b'; // Orange for carbs
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  // Draw carbs amount text above
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(carbs + 'g', x, y - radius - 2);
}

/**
 * Draw combined marker (insulin + carbs) as triangle with dot
 */
function drawCombinedMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  insulin: number,
  carbs: number
) {
  const size = 8;

  // Draw triangle (insulin)
  ctx.fillStyle = '#3b82f6';
  ctx.strokeStyle = '#1e40af';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x - size, y - size);
  ctx.lineTo(x + size, y - size);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw small circle inside (carbs indicator)
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, 2 * Math.PI);
  ctx.fill();

  // Draw combined text below
  ctx.fillStyle = '#8b5cf6'; // Purple for combined
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${insulin.toFixed(1)}U + ${carbs}g`, x, y + size + 2);
}
