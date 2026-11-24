"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactSubjectLabel } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TeacherAnalytics } from "@/types";

export default function TeacherCharts({
  analytics,
}: {
  analytics: TeacherAnalytics;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Weekly Classroom Activity (7 Days)</CardTitle>
          <CardDescription>
            Completed lessons and educational games across students.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-56 sm:h-64 lg:h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={analytics.weekly_completions}
              margin={{ top: 8, right: 8, left: -14, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#24334D14" />
              <XAxis dataKey="day" tick={{ fill: "#24334D", fontSize: 11 }} />
              <YAxis width={34} tick={{ fill: "#24334D", fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="lessons"
                name="Lessons"
                fill="#9BE7C4"
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="games"
                name="Games"
                fill="#78C8F5"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subject Skill Mastery Overview</CardTitle>
          <CardDescription>
            Average mastery percentage by kindergarten domain.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-56 sm:h-64 lg:h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={analytics.subject_averages}
              margin={{ top: 8, right: 8, left: -12, bottom: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#24334D14" />
              <XAxis
                dataKey="subject_name"
                tickFormatter={formatCompactSubjectLabel}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={48}
                tick={{ fill: "#24334D", fontSize: 11 }}
              />
              <YAxis
                width={36}
                domain={[0, 100]}
                tick={{ fill: "#24334D", fontSize: 11 }}
              />
              <Tooltip />
              <Bar
                dataKey="avg_mastery_pct"
                name="Avg Mastery %"
                fill="#B8A5F5"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
