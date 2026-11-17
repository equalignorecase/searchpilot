"use client";
import { thaiLabel, formatDate } from "@/lib/locale";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
export type Daily = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};
export function PerformanceChart({
  data,
  metric = "clicks",
}: {
  data: Daily[];
  metric?: "clicks" | "impressions" | "ctr" | "position";
}) {
  return (
    <div
      className="chart-wrap"
      role="img"
      aria-label={`${thaiLabel(metric)}ตามเวลา จำนวน ${data.length} วันรายงาน`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 22, left: 0, bottom: 8 }}
          accessibilityLayer
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => formatDate(String(v))}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis
            reversed={metric === "position"}
            tickFormatter={(v) =>
              metric === "ctr"
                ? (Number(v) * 100).toFixed(1) + "%"
                : Number(v).toLocaleString("th-TH")
            }
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={65}
          />
          <Tooltip
            labelFormatter={(value) => formatDate(String(value))}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) =>
              metric === "ctr"
                ? (Number(value) * 100).toFixed(2) + "%"
                : Number(value).toLocaleString("th-TH", {
                    maximumFractionDigits: 2,
                  })
            }
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingTop: 14 }}
          />
          <Line
            type="monotone"
            dataKey={metric}
            name={
              {
                clicks: "คลิก",
                impressions: "การแสดงผล",
                ctr: "CTR",
                position: "อันดับเฉลี่ย",
              }[metric]
            }
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
