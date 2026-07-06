import { CatalogueSkeleton } from '@/components/ui/DashboardSkeleton';

export default function CatalogueLoading() {
  return (
    <div className="min-h-screen bg-black px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <CatalogueSkeleton />
      </div>
    </div>
  );
}
