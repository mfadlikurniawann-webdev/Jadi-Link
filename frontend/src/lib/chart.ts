export function chartGeometry(values: number[], width = 760, height = 220) {
  const top = Math.max(1, ...values);
  const points = values.map((value, index) => ({
    x: 20 + (index * (width - 40)) / Math.max(1, values.length - 1),
    y: height - 20 - (value / top) * (height - 40),
  }));
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const first = points[0];
  const last = points.at(-1);
  const area =
    first && last
      ? `${line} L ${last.x} ${height - 20} L ${first.x} ${height - 20} Z`
      : '';
  return { points, line, area, top };
}
