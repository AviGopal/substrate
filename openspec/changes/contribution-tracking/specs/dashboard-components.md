# Dashboard Contribution Components Specification

## Overview

New dashboard page and components for visualizing member contributions in the `metabob-cloud-dashboard`.

## Page Structure

### Route: `/contributions`

Main contributions page accessible from sidebar navigation.

```typescript
// src/pages/Contributions.tsx
export function Contributions() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contributions"
        description="Track your activity and impact"
      />

      <Tabs defaultValue="my">
        <TabsList>
          <TabsTrigger value="my">My Contributions</TabsTrigger>
          {isAdmin && <TabsTrigger value="team">Team</TabsTrigger>}
          {isAdmin && <TabsTrigger value="export">Export</TabsTrigger>}
        </TabsList>

        <TabsContent value="my">
          <MyContributions userId={user.id} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="team">
            <TeamContributions orgId={user.org_id} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="export">
            <ExportContributions orgId={user.org_id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
```

## Components

### ContributionSummaryCards

Display key metrics as summary cards.

```typescript
// src/components/contributions/ContributionSummaryCards.tsx
interface ContributionSummaryCardsProps {
  metrics: {
    total_executions: number;
    success_rate: number;
    total_cost_usd: number;
    unique_projects: number;
    templates_created?: number;
    issues_found?: number;
  };
  comparisonMetrics?: {
    // Previous period for trend indicators
    total_executions: number;
    success_rate: number;
    total_cost_usd: number;
  };
  isLoading?: boolean;
}

export function ContributionSummaryCards({
  metrics,
  comparisonMetrics,
  isLoading,
}: ContributionSummaryCardsProps) {
  if (isLoading) {
    return <CardsSkeleton count={4} />;
  }

  const executionsTrend = comparisonMetrics
    ? calculateTrend(metrics.total_executions, comparisonMetrics.total_executions)
    : null;

  const successTrend = comparisonMetrics
    ? calculateTrend(metrics.success_rate, comparisonMetrics.success_rate)
    : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Executions"
        value={metrics.total_executions}
        trend={executionsTrend}
        icon={<PlayCircle />}
      />
      <MetricCard
        title="Success Rate"
        value={`${metrics.success_rate.toFixed(1)}%`}
        trend={successTrend}
        icon={<CheckCircle />}
        valueClassName={metrics.success_rate >= 80 ? "text-green-500" : "text-yellow-500"}
      />
      <MetricCard
        title="Total Cost"
        value={`$${metrics.total_cost_usd.toFixed(2)}`}
        icon={<DollarSign />}
      />
      <MetricCard
        title="Projects"
        value={metrics.unique_projects}
        icon={<FolderOpen />}
      />
    </div>
  );
}
```

### ContributionTrendChart

Time-series visualization of contribution metrics.

```typescript
// src/components/contributions/ContributionTrendChart.tsx
interface ContributionTrendChartProps {
  data: TimeSeriesPoint[];
  metric: 'executions' | 'success_rate' | 'cost' | 'duration';
  period: 'day' | 'week';
  isLoading?: boolean;
}

interface TimeSeriesPoint {
  date: string;
  value: number;
  executions?: number;
  success_rate?: number;
  cost_usd?: number;
}

export function ContributionTrendChart({
  data,
  metric,
  period,
  isLoading,
}: ContributionTrendChartProps) {
  if (isLoading) {
    return <ChartSkeleton height={250} />;
  }

  const chartData = data.map((point) => ({
    date: formatDate(point.date, period === 'day' ? 'MMM d' : 'Week of MMM d'),
    value: point.value,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contribution Trend</CardTitle>
        <CardDescription>
          {metric === 'executions' && 'Executions over time'}
          {metric === 'success_rate' && 'Success rate over time'}
          {metric === 'cost' && 'Cost over time'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          {/* Use recharts or similar */}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--accent))"
                fill="hsl(var(--accent) / 0.2)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

### ContributionByProjectTable

Breakdown of contributions by project.

```typescript
// src/components/contributions/ContributionByProjectTable.tsx
interface ContributionByProjectTableProps {
  data: ProjectContribution[];
  isLoading?: boolean;
}

interface ProjectContribution {
  project_id: string;
  project_name: string;
  executions_count: number;
  success_count: number;
  success_rate: number;
  total_cost_usd: number;
  last_execution: string;
}

export function ContributionByProjectTable({
  data,
  isLoading,
}: ContributionByProjectTableProps) {
  const columns = [
    {
      header: "Project",
      accessorKey: "project_name",
      cell: ({ row }) => (
        <Link to={`/projects/${row.original.project_id}`} className="hover:underline">
          {row.original.project_name}
        </Link>
      ),
    },
    {
      header: "Executions",
      accessorKey: "executions_count",
      cell: ({ row }) => row.original.executions_count.toLocaleString(),
    },
    {
      header: "Success Rate",
      accessorKey: "success_rate",
      cell: ({ row }) => (
        <Badge variant={row.original.success_rate >= 80 ? "success" : "warning"}>
          {row.original.success_rate.toFixed(1)}%
        </Badge>
      ),
    },
    {
      header: "Cost",
      accessorKey: "total_cost_usd",
      cell: ({ row }) => `$${row.original.total_cost_usd.toFixed(2)}`,
    },
    {
      header: "Last Active",
      accessorKey: "last_execution",
      cell: ({ row }) => formatRelativeTime(row.original.last_execution),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contributions by Project</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          emptyMessage="No project contributions yet"
        />
      </CardContent>
    </Card>
  );
}
```

### TeamContributionLeaderboard

Ranked list of team member contributions.

```typescript
// src/components/contributions/TeamContributionLeaderboard.tsx
interface TeamContributionLeaderboardProps {
  data: RankedContribution[];
  metric: string;
  isLoading?: boolean;
  onMetricChange: (metric: string) => void;
}

interface RankedContribution {
  rank: number;
  user_id: string;
  user_name: string;
  metric_value: number;
  executions_count: number;
  success_rate: number;
  total_cost_usd: number;
  trend: 'up' | 'down' | 'stable';
  trend_change: number;
}

export function TeamContributionLeaderboard({
  data,
  metric,
  isLoading,
  onMetricChange,
}: TeamContributionLeaderboardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Team Leaderboard</CardTitle>
          <CardDescription>Top contributors this month</CardDescription>
        </div>
        <Select value={metric} onValueChange={onMetricChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Rank by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="executions">Executions</SelectItem>
            <SelectItem value="success_rate">Success Rate</SelectItem>
            <SelectItem value="cost_efficiency">Cost Efficiency</SelectItem>
            <SelectItem value="projects">Projects Touched</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : (
          <div className="space-y-4">
            {data.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
              >
                <div className="text-2xl font-bold text-muted-foreground w-8">
                  #{member.rank}
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{getInitials(member.user_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{member.user_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {member.executions_count} executions | {member.success_rate.toFixed(1)}% success
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">
                    {formatMetricValue(member.metric_value, metric)}
                  </div>
                  <TrendIndicator
                    direction={member.trend}
                    value={member.trend_change}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### ExportContributionsForm

Form for generating contribution exports.

```typescript
// src/components/contributions/ExportContributionsForm.tsx
interface ExportContributionsFormProps {
  orgId: string;
  onExport: (options: ExportOptions) => Promise<void>;
}

interface ExportOptions {
  format: 'csv' | 'json';
  period: 'day' | 'week' | 'month';
  start_date: string;
  end_date: string;
  include_users?: string[];
}

export function ExportContributionsForm({ orgId, onExport }: ExportContributionsFormProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport({
        format,
        period,
        start_date: dateRange.from.toISOString(),
        end_date: dateRange.to.toISOString(),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Contributions</CardTitle>
        <CardDescription>
          Generate a report of member contributions for the selected period
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as 'csv' | 'json')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (spreadsheet)</SelectItem>
                <SelectItem value="json">JSON (programmatic)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Granularity</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as 'day' | 'week' | 'month')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Date Range</Label>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            maxDate={new Date()}
          />
        </div>

        <Button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full"
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Export...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export Contributions
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

## Hooks

### useContributions

Hook for fetching user contribution data.

```typescript
// src/hooks/useContributions.ts
interface UseContributionsOptions {
  userId: string;
  period?: 'day' | 'week' | 'month' | 'all_time';
  startDate?: Date;
  endDate?: Date;
}

interface UseContributionsResult {
  contributions: MemberContribution[];
  summary: ContributionSummary;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useContributions({
  userId,
  period = 'month',
  startDate,
  endDate,
}: UseContributionsOptions): UseContributionsResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contributions', userId, period, startDate, endDate],
    queryFn: () => getUserContributions(userId, { period, startDate, endDate }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    contributions: data?.contributions ?? [],
    summary: data?.summary ?? defaultSummary,
    isLoading,
    error,
    refetch,
  };
}
```

### useContributionTrend

Hook for fetching trend data.

```typescript
// src/hooks/useContributionTrend.ts
interface UseContributionTrendOptions {
  userId: string;
  period?: 'day' | 'week';
  days?: number;
  metric?: 'executions' | 'success_rate' | 'cost' | 'duration';
}

export function useContributionTrend({
  userId,
  period = 'day',
  days = 30,
  metric = 'executions',
}: UseContributionTrendOptions) {
  return useQuery({
    queryKey: ['contribution-trend', userId, period, days, metric],
    queryFn: () => getUserContributionsTrend(userId, { period, days, metric }),
    staleTime: 5 * 60 * 1000,
  });
}
```

### useTeamContributions

Hook for fetching org-wide contributions (admin only).

```typescript
// src/hooks/useTeamContributions.ts
interface UseTeamContributionsOptions {
  orgId: string;
  period?: 'day' | 'week' | 'month';
  metric?: string;
}

export function useTeamContributions({
  orgId,
  period = 'month',
  metric = 'executions',
}: UseTeamContributionsOptions) {
  return useQuery({
    queryKey: ['team-contributions', orgId, period, metric],
    queryFn: () => getOrgContributions(orgId, { period }),
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeaderboard({
  orgId,
  period = 'month',
  metric = 'executions',
  limit = 10,
}: UseLeaderboardOptions) {
  return useQuery({
    queryKey: ['leaderboard', orgId, period, metric, limit],
    queryFn: () => getOrgLeaderboard(orgId, { period, metric, limit }),
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000,
  });
}
```

## API Client Functions

```typescript
// src/lib/api/contributions-api.ts
const BASE_URL = '/api/activity';

export async function getUserContributions(
  userId: string,
  options: { period?: string; startDate?: Date; endDate?: Date }
): Promise<GetUserContributionsResponse> {
  const params = new URLSearchParams();
  if (options.period) params.set('period', options.period);
  if (options.startDate) params.set('start_date', options.startDate.toISOString());
  if (options.endDate) params.set('end_date', options.endDate.toISOString());

  return get(`${BASE_URL}/users/${userId}/contributions?${params}`);
}

export async function getUserContributionsTrend(
  userId: string,
  options: { period?: string; days?: number; metric?: string }
): Promise<GetUserContributionsTrendResponse> {
  const params = new URLSearchParams();
  if (options.period) params.set('period', options.period);
  if (options.days) params.set('days', String(options.days));
  if (options.metric) params.set('metric', options.metric);

  return get(`${BASE_URL}/users/${userId}/contributions/trend?${params}`);
}

export async function getOrgContributions(
  orgId: string,
  options: { period?: string; startDate?: Date; endDate?: Date }
): Promise<GetOrgContributionsResponse> {
  const params = new URLSearchParams();
  if (options.period) params.set('period', options.period);
  if (options.startDate) params.set('start_date', options.startDate.toISOString());
  if (options.endDate) params.set('end_date', options.endDate.toISOString());

  return get(`${BASE_URL}/organizations/${orgId}/contributions?${params}`);
}

export async function getOrgLeaderboard(
  orgId: string,
  options: { period?: string; metric?: string; limit?: number }
): Promise<GetLeaderboardResponse> {
  const params = new URLSearchParams();
  if (options.period) params.set('period', options.period);
  if (options.metric) params.set('metric', options.metric);
  if (options.limit) params.set('limit', String(options.limit));

  return get(`${BASE_URL}/organizations/${orgId}/contributions/leaderboard?${params}`);
}

export async function exportContributions(
  orgId: string,
  options: ExportOptions
): Promise<Blob> {
  const response = await post(
    `${BASE_URL}/organizations/${orgId}/contributions/export`,
    options
  );
  return response.blob();
}
```

## Navigation Integration

Add Contributions to sidebar navigation.

```typescript
// src/components/layout/Sidebar.tsx
const navItems = [
  // ... existing items
  {
    title: 'Contributions',
    href: '/contributions',
    icon: BarChart3,
  },
];
```
