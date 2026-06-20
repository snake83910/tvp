/**
 * Mini graphique SVG d'une série de valeurs.
 * Stateless, sans dépendance externe.
 */
export function Sparkline({
  values,
  width = 100,
  height = 32,
  color = "var(--signal, #D8232A)",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) {
    return <div style={{ width, height }} className="rounded bg-paper-dim" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath = `M0,${height} L${points.replace(/ /g, " L")} L${width},${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block" width={width} height={height}>
      <path d={areaPath} fill={color} fillOpacity="0.08" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
