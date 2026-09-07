import { PageHeader } from "@/components/ui";
import { OptimizerForm } from "./optimizer-form";

export const dynamic = "force-dynamic";

export default function OptimizerPage() {
  return (
    <div>
      <PageHeader
        kicker="Vessel–port fit engine · draft, LOA, gear, congestion"
        title="The right hull,"
        accent="first time."
        description="Input the cargo, load port and discharge port. The engine stress-tests every vessel class against hard infrastructure limits on both ends, prices the voyage at forward hire levels, and ranks the fleet on all-in $ per tonne."
      />
      <OptimizerForm />
    </div>
  );
}
