'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';

/*
 * Chart styling reads the shadcn CSS variables so the palette stays in lockstep
 * with the zinc theme: near-white primary series, emerald secondary, zinc grid.
 */
const GRID = 'var(--border)';
const AXIS = 'var(--muted-foreground)';
const SERIES_PRIMARY = 'var(--chart-1)';
const SERIES_SECONDARY = 'var(--chart-2)';

export interface VolumePoint {
  label: string;
  total: number;
  completed: number;
}

export interface StatusPoint {
  label: string;
  count: number;
}

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-foreground">{String(label ?? '')}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="text-xs text-muted-foreground">
          <span
            className="mr-1.5 inline-block size-2 rounded-[2px] align-middle"
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Area chart of daily call volume (total vs completed). */
export function CallVolumeChart({ data }: { data: VolumePoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_PRIMARY} stopOpacity={0.18} />
              <stop offset="100%" stopColor={SERIES_PRIMARY} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_SECONDARY} stopOpacity={0.18} />
              <stop offset="100%" stopColor={SERIES_SECONDARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke={AXIS}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke={AXIS}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={40}
          />
          <Tooltip content={ChartTooltip} cursor={{ stroke: GRID }} />
          <Area
            type="monotone"
            dataKey="total"
            name="Total calls"
            stroke={SERIES_PRIMARY}
            strokeWidth={1.5}
            fill="url(#fillTotal)"
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Area
            type="monotone"
            dataKey="completed"
            name="Completed"
            stroke={SERIES_SECONDARY}
            strokeWidth={1.5}
            fill="url(#fillCompleted)"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal-feel bar chart of call counts per status. */
export function StatusDistributionChart({ data }: { data: StatusPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke={AXIS}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            stroke={AXIS}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={40}
          />
          <Tooltip content={ChartTooltip} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
          <Bar
            dataKey="count"
            name="Calls"
            fill={SERIES_PRIMARY}
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
