"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/lib/money";

/*
 * Charts for the merchant dashboard.
 *
 * Three decisions worth stating, because each is a rule rather than a taste:
 *
 *   One measure per chart. Visitors, orders and revenue are different scales,
 *   and putting two on one plot with two y-axes is the single most misleading
 *   thing a dashboard can do — the crossing point is an artefact of the axes.
 *
 *   One series means no legend. The card's own title names it; a legend box
 *   for a single line is furniture.
 *
 *   A tooltip by default. A line chart without one can only be read to the
 *   nearest gridline, which for a merchant asking "how many on Tuesday" is not
 *   an answer.
 *
 * Colours come from the authored --bh-chart-* tokens, NOT the Tailwind-generated
 * --color-chart-* ones. Tailwind v4 emits a theme variable only when some
 * utility references it, so a variable used solely inside an inline style is
 * tree-shaken away — every bar and line here rendered colourless before this
 * was understood. Inline styles use --bh-*; class names use the utilities.
 *
 * The palette itself is validated for colour-blind separation and contrast in
 * both themes. Text never wears the series colour.
 */

export interface Point {
  day: string;
  value: number;
}

function shortDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function TrendChart({
  data,
  series,
  format = "number",
  currency = "INR",
}: {
  data: Point[];
  /** Which validated chart slot this series uses. */
  series: 1 | 2 | 3 | 4 | 5 | 6;
  format?: "number" | "money";
  currency?: string;
}) {
  const colour = `var(--bh-chart-${series})`;
  const gradientId = `bh-grad-${series}`;
  const show = (value: number) =>
    format === "money" ? formatMoney(value, currency) : value.toLocaleString();

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* Right margin clears the final point. At 6px the most recent day — the
            one a merchant actually cares about — was clipped by the plot edge. */}
        <AreaChart data={data} margin={{ top: 6, right: 14, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colour} stopOpacity={0.22} />
              <stop offset="100%" stopColor={colour} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Recessive: horizontal only, so the grid supports reading values
              without competing with the line. */}
          <CartesianGrid
            vertical={false}
            stroke="var(--bh-border)"
            strokeDasharray="0"
          />
          <XAxis
            dataKey="day"
            tickFormatter={(day) => shortDay(String(day))}
            tick={{ fill: "var(--bh-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: "var(--bh-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v) =>
              format === "money" ? String(Math.round(Number(v) / 100)) : String(v)
            }
          />
          <Tooltip
            cursor={{ stroke: "var(--bh-border-strong)", strokeWidth: 1 }}
            contentStyle={{
              background: "var(--bh-surface)",
              border: "1px solid var(--bh-border)",
              borderRadius: 8,
              fontSize: 12,
              // Text in ink, never the series colour.
              color: "var(--bh-text)",
              boxShadow: "var(--shadow-md)",
            }}
            labelFormatter={(day) =>
              new Date(`${String(day)}T00:00:00Z`).toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "long",
              })
            }
            formatter={(value) => [show(Number(value ?? 0)), ""]}
            separator=""
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={colour}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--bh-surface)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/*
 * The funnel.
 *
 * Not a tapering funnel shape — that encodes magnitude as an area whose width
 * and height both change, which nobody reads accurately. Proportional bars with
 * the drop-off stated in words are legible at a glance and honest about what
 * they mean.
 */
export function Funnel({
  stages,
}: {
  stages: { label: string; value: number; hint?: string }[];
}) {
  const top = Math.max(...stages.map((s) => s.value), 1);

  return (
    <ol className="flex flex-col gap-4">
      {stages.map((stage, i) => {
        const previous = i === 0 ? null : stages[i - 1]!.value;
        const rate = previous && previous > 0 ? Math.round((stage.value / previous) * 100) : null;
        return (
          <li key={stage.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-text-secondary text-sm">{stage.label}</span>
              <span className="text-text text-sm tabular-nums">
                {stage.value.toLocaleString()}
                {rate !== null ? (
                  <span className="text-muted ml-2 text-xs">{rate}% of previous</span>
                ) : null}
              </span>
            </div>
            <div className="bg-sunken mt-1.5 h-2.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width] duration-(--bh-duration-slow) ease-(--ease-out)"
                style={{
                  width: `${Math.max((stage.value / top) * 100, stage.value > 0 ? 2 : 0)}%`,
                  background: `var(--bh-chart-${(i % 6) + 1})`,
                }}
              />
            </div>
            {stage.hint ? <p className="text-faint mt-1 text-xs">{stage.hint}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
