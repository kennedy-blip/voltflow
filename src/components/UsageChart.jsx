import { useId, useMemo, useState } from 'react';
import { Activity, CalendarDays } from 'lucide-react';
import { formatDay, formatUnits, usageSeries } from '../lib/ledger.js';
import { EmptyState, PanelHeading } from './ui.jsx';

const W = 640;
const H = 160;
const P = 10;
const pathThrough = (segment) => segment.reduce((path, point, index) => {
  if (!index) return `M ${point.x},${point.y}`;
  const prev = segment[index - 1];
  const midpoint = (point.x + prev.x) / 2;
  return `${path} C ${midpoint},${prev.y} ${midpoint},${point.y} ${point.x},${point.y}`;
}, '');

function ChartPlot({ data, period }) {
  const gradient = useId();
  const [active, setActive] = useState(null);
  const count = data.length;
  const max = Math.max(6, Math.ceil(Math.max(...data.map((point) => point.value ?? 0)) / 6) * 6);
  const points = data.map((point, i) => ({ ...point, x: P + (W - P * 2) * i / (count - 1), y: H - ((point.value ?? 0) / max) * H }));
  const segments = [];
  let segment = [];
  for (const point of points) {
    if (point.value == null) { if (segment.length) segments.push(segment); segment = []; }
    else segment.push(point);
  }
  if (segment.length) segments.push(segment);
  const hasData = segments.length > 0;
  const selected = active != null ? points[active] : null;
  const guide = selected ?? [...points].reverse().find((point) => point.value != null);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labels = period === 7 ? points : points.filter((_, i) => i === 0 || i === 7 || i === 14 || i === 21 || i === 29);

  if (!hasData) return <EmptyState icon={CalendarDays} title="No usage logged yet" description="Add a daily meter reading to see how your usage changes over time." />;
  return <div className="chart-content">
    <div className="chart-y-axis" aria-hidden="true">{[...ticks].reverse().map((tick) => <span key={tick}>{Number((tick * max).toFixed(2))}</span>)}</div>
    <div className="chart-right">
      <div className="chart-plot" role="group" tabIndex={0} aria-label="Daily energy usage. Use the left and right arrows to inspect readings." onPointerMove={(event) => {
        if (event.pointerType === 'touch') return;
        const { left, width } = event.currentTarget.getBoundingClientRect();
        setActive(Math.max(0, Math.min(count - 1, Math.round(((event.clientX - left) / width * W - P) / (W - 2 * P) * (count - 1)))));
      }} onPointerLeave={() => setActive(null)} onClick={(event) => {
        const { left, width } = event.currentTarget.getBoundingClientRect();
        setActive(Math.max(0, Math.min(count - 1, Math.round(((event.clientX - left) / width * W - P) / (W - 2 * P) * (count - 1)))));
      }} onBlur={() => setActive(null)} onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Escape') setActive(null);
        else if (event.key === 'Home') setActive(0);
        else if (event.key === 'End') setActive(count - 1);
        else setActive((prev) => Math.max(0, Math.min(count - 1, (prev ?? count - 1) + (event.key === 'ArrowLeft' ? -1 : 1))));
      }}>
        <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--chart)" stopOpacity=".26"/><stop offset="1" stopColor="var(--chart)" stopOpacity=".015"/></linearGradient></defs>
          {ticks.map((tick) => <line key={tick} x1="0" x2={W} y1={Math.max(1, Math.min(H - 1, H * tick))} y2={Math.max(1, Math.min(H - 1, H * tick))} stroke="var(--line-strong)" strokeDasharray={tick === 1 ? undefined : '3 5'} vectorEffect="non-scaling-stroke" />)}
          {segments.map((run) => {
            const line = pathThrough(run);
            return <g key={run[0].date}>
              {run.length > 1 && <><path d={`${line} L${run.at(-1).x},${H} L${run[0].x},${H} Z`} fill={`url(#${gradient})`} /><path d={line} fill="none" stroke="var(--chart)" strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></>}
              {(period === 7 || run.length === 1) && run.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="3.2" fill="var(--surface)" stroke="var(--chart)" strokeWidth="1.55" vectorEffect="non-scaling-stroke" />)}
            </g>;
          })}
          {guide && <line x1={guide.x} x2={guide.x} y1={0} y2={H} stroke="var(--chart)" strokeOpacity=".45" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />}
        </svg>
        {guide?.value != null && <span className="chart-selected-dot" aria-hidden="true" style={{ left: `${guide.x / W * 100}%`, top: `${guide.y / H * 100}%` }} />}
        {selected && <span className="chart-tooltip" role="status" style={{ left: `clamp(49px, ${selected.x / W * 100}%, calc(100% - 49px))`, top: `${Math.max(25, Math.min(88, selected.y / H * 100))}%` }}><small>{formatDay(selected.date, { month: 'short', day: 'numeric' })}</small><strong>{selected.value == null ? 'No reading' : `${formatUnits(selected.value)} kWh`}</strong></span>}
      </div>
      <div className="chart-x-axis" aria-hidden="true">{labels.map((point) => <span key={point.date}>{formatDay(point.date, period === 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' })}</span>)}</div>
    </div>
  </div>;
}

export default function UsageChart({ readings, day }) {
  const [period, setPeriod] = useState(7);
  const data = useMemo(() => usageSeries(readings, period, day), [readings, period, day]);
  return <section className="glass-panel chart-card" aria-label="Energy consumption">
    <PanelHeading icon={Activity} title="Energy consumption" description="Daily power usage in kilowatt-hours" actions={<div className="segment" aria-label="Chart time range">
      {[7, 30].map((days) => <button type="button" key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>{days} days</button>)}
    </div>} />
    <ChartPlot key={period} data={data} period={period} />
    <div className="chart-footer"><span><i /> Metered usage</span><span>{formatDay(data[0].date, { month: 'short', day: 'numeric' })} – {formatDay(day, { month: 'short', day: 'numeric' })}</span></div>
  </section>;
}
