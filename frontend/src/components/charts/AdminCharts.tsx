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
import type { AdminAnalytics } from "@/types";

export default function AdminCharts({
  analytics,
}: {
  analytics: AdminAnalytics;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
      <Card>
        <CardHeader>
          <CardTitle>7-Day Platform Learning Activity</CardTitle>
          <CardDescription>
            Daily completed lessons, educational games, and home activities.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-56 sm:h-64 lg:h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={analytics.daily_activity}
              margin={{ top: 8, right: 8, left: -14, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#24334D14" />
              <XAxis dataKey="day" tick={{ fill: "#24334D", fontSize: 11 }} />
              <YAxis
                width={34}
                allowDecimals={false}
                tick={{ fill: "#24334D", fontSize: 11 }}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="lessons"
                name="Lessons"
                fill="#78C8F5"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="games"
                name="Games"
                fill="#9BE7C4"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="home_activities"
                name="Home Hub"
                fill="#FFE58A"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subject Content Distribution</CardTitle>
          <CardDescription>
            Available lessons and interactive games across early learning modules.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-56 sm:h-64 lg:h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={analytics.subject_distribution}
              margin={{ top: 8, right: 8, left: -14, bottom: 16 }}
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
                width={34}
                allowDecimals={false}
                tick={{ fill: "#24334D", fontSize: 11 }}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="lessons"
                name="Lessons"
                fill="#B8A5F5"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="games"
                name="Games"
                fill="#FF9C8C"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
