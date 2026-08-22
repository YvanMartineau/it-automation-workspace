import React, { useState } from "react";
import { Plus, History, Clock } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { GenerateReportModal } from "#/components/reports/GenerateReportModal";
import { useReportHistory } from "#/hooks/useReports";

export const ReportsPage: React.FC = () => {
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const { data: history, isLoading, isError, refetch } = useReportHistory();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Report Gallery</h1>
          <p className="text-sm text-muted-foreground">
            Generieren Sie individuelle PDF-Berichte und überprüfen Sie das Versandprotokoll.
          </p>
        </div>
        <Button onClick={() => setIsGenerateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neuen Bericht Anfordern
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Berichts-Historie</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Fehler beim Laden der Berichts-Historie.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Erneut versuchen
              </Button>
            </div>
          ) : history && history.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Berichtsname</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Ausgelöst von</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Gesendet am</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.report_name}</TableCell>
                    <TableCell className="capitalize">{item.report_type}</TableCell>
                    <TableCell>{item.triggered_by}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.recipient_email}</TableCell>
                    <TableCell className="tabular-nums">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(item.sent_at).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize">{item.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Keine Berichte in der Historie gefunden.
            </div>
          )}
        </CardContent>
      </Card>

      <GenerateReportModal open={isGenerateOpen} onOpenChange={setIsGenerateOpen} />
    </div>
  );
};

export default ReportsPage;
