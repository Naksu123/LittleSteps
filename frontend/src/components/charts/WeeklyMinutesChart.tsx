"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyActivityPoint } from "@/types";

export default function WeeklyMinutesChart({
  data,
}: {
  data: WeeklyActivityPoint[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#24334D14" />
        <XAxis dataKey="day" tick={{ fill: "#24334D", fontSize: 11 }} />
        <YAxis width={36} tick={{ fill: "#24334D", fontSize: 11 }} />
        <Tooltip />
        <Bar
          dataKey="minutes"
          name="Minutes"
          fill="#78C8F5"
          radius={[10, 10, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
