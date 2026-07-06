/* Shared pulsing skeleton for dashboard-style route segments (buyer/admin/finance/inventory
   dashboards, catalogue listing). Kept dependency-free so it can be dropped straight into any
   loading.js file. */
export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-7">
      <div className="h-36 rounded-3xl bg-slate-200/70" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-64 rounded-2xl bg-slate-200/70" />
        <div className="h-64 rounded-2xl bg-slate-200/70" />
      </div>
    </div>
  );
}

export function CatalogueSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] rounded-3xl border border-white/10 bg-white/[0.03]" />
      ))}
    </div>
  );
}
