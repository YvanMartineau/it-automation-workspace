import React, { useState } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { ReportCard } from "#/components/reports/ReportCard";
import { GenerateReportModal } from "#/components/reports/GenerateReportModal";
import { ReportPreviewModal } from "#/components/reports/ReportPreviewModal";
import { useReports } from "#/hooks/useReports";
import { Report, reportTypeLabels } from "#/types/report";

export const ReportsPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);

  const { data: reports, isLoading, isError, refetch } = useReports({
    type: selectedType !== "all" ? selectedType : undefined,
    search: search || undefined,
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Report Gallery</h1>
          <p className="text-sm text-muted-foreground">
            Erstellen, betrachten und exportieren Sie Systemberichte und Compliance-Protokolle.
          </p>
        </div>
        <Button onClick={() => setIsGenerateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Bericht Erstellen
        </Button>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Berichte suchen..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={selectedType} onValueChange={(value) => value !== null && setSelectedType(value)}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.entries(reportTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col space-y-3 rounded-lg border p-6">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="space-y-2 pt-4">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
              <div className="flex gap-2 pt-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Fehler beim Laden der Berichte. Bitte versuchen Sie es erneut.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Erneut versuchen
          </Button>
        </div>
      ) : reports && reports.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} onPreview={setPreviewReport} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">Keine Berichte gefunden.</p>
        </div>
      )}

      {/* Modals */}
      <GenerateReportModal open={isGenerateOpen} onOpenChange={setIsGenerateOpen} />
      <ReportPreviewModal report={previewReport} onClose={() => setPreviewReport(null)} />
    </div>
  );
};

export default ReportsPage;