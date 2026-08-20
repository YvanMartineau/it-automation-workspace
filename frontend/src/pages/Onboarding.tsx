// src/pages/Onboarding.tsx
import { useOnboardingList } from "#/hooks/useOnboarding";
import { OnboardingCard } from "#/components/onboarding/OnboardingCard";
import { OnboardingFormDialog } from "#/components/onboarding/OnboardingFormDialog";
import { TableSkeleton } from "#/components/feedback/TableSkeleton"; // Assuming this exists
import type { OnboardingStatus } from "#types/onboarding.ts";

const COLUMNS: { id: OnboardingStatus | "ALL"; label: string }[] = [
  { id: "ALL", label: "Alle" },
  { id: "PENDING", label: "Ausstehend" },
  { id: "AD_CREATING", label: "AD Erstellung" },
  { id: "EMAIL_SENDING", label: "E-Mail Versand" },
  { id: "JIRA_CREATING", label: "Jira Erstellung" },
  { id: "COMPLETED", label: "Abgeschlossen" },
  { id: "FAILED", label: "Fehlgeschlagen" },
];

export default function OnboardingPage() {
  const { data: records, isLoading, isError } = useOnboardingList();

  if (isLoading) return <TableSkeleton rows={4} columns={4} />;
  if (isError) return <div className="p-6 text-danger">Fehler beim Laden der Onboarding-Daten.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Onboarding Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verwalten und überwachen Sie Automatisierungs-Workflows (n8n, Jira, AD).
          </p>
        </div>
        <OnboardingFormDialog />
      </div>

      {/* Hybrid Kanban Board Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {COLUMNS.filter(col => col.id !== "ALL").map((column) => {
          const columnRecords = records?.filter((r) => r.status === column.id) || [];
          
          return (
            <div key={column.id} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  {column.label}
                </h3>
                <span className="bg-muted text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                  {columnRecords.length}
                </span>
              </div>
              
              <div className="space-y-4 min-h-[200px]">
                {columnRecords.length === 0 ? (
                  <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center text-sm text-muted-foreground">
                    Keine Vorgänge
                  </div>
                ) : (
                  columnRecords.map((record) => (
                    <OnboardingCard key={record.id} record={record} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}