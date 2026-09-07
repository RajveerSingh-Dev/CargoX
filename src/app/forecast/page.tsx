import { PageHeader } from "@/components/ui";
import { ForecastExplorer } from "./explorer";

export const dynamic = "force-dynamic";

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const cls = typeof sp.class === "string" ? sp.class : undefined;
  const route = typeof sp.route === "string" ? Number(sp.route) : undefined;

  return (
    <div>
      <PageHeader
        kicker="Predictive rate engine · Holt-damped ensemble"
        title="Where is the market"
        accent="actually going?"
        description="Select a vessel segment and corridor. The engine decomposes two years of prints into trend and calendar seasonality, optimises smoothing parameters against holdout error, then projects a probability fan for your fixing horizon."
      />
      <ForecastExplorer initialClass={cls} initialRoute={route && Number.isFinite(route) ? route : undefined} />
    </div>
  );
}
