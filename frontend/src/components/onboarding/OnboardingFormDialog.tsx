// src/components/onboarding/OnboardingFormDialog.tsx — Premium Edition (Fixed)
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "#/components/ui/form";
import { Input } from "#/components/ui/input";
import { Button } from "#/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip";
import { Plus, Lock, Loader2, UserPlus } from "lucide-react";
import { onboardingFormSchema, type OnboardingFormValues } from "#/lib/validators";
import { useCreateOnboarding } from "#/hooks/useOnboarding";
import { cn } from "#/lib/utils";

export function OnboardingFormDialog() {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateOnboarding();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      department: "",
      job_title: "",
    },
  });

  const onSubmit = (data: OnboardingFormValues) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* FIX: DialogTrigger renders its own <button> — do NOT nest a <Button> inside it */}
      <DialogTrigger
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "h-10 px-5 py-2 shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Onboarding starten
      </DialogTrigger>

      <DialogContent className="sm:max-w-[520px] rounded-2xl p-0 overflow-hidden">
        {/* Header with gradient accent */}
        <div className="relative bg-gradient-to-br from-primary/5 to-primary/[0.02] px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Neuen Onboarding-Vorgang erstellen</DialogTitle>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Neuer Mitarbeiter wird der Pipeline hinzugefügt.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Name Row */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                        Vorname
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Max"
                          className="rounded-xl h-10 focus-visible:ring-primary/30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                        Nachname
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Mustermann"
                          className="rounded-xl h-10 focus-visible:ring-primary/30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                      E-Mail
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="max.mustermann@company.com"
                        className="rounded-xl h-10 focus-visible:ring-primary/30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Department & Job Title */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                        Abteilung
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Engineering"
                          className="rounded-xl h-10 focus-visible:ring-primary/30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="job_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                        Berufsbezeichnung
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Software Engineer"
                          className="rounded-xl h-10 focus-visible:ring-primary/30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  className="flex-1 rounded-xl h-10 gap-2"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {createMutation.isPending ? "Wird erstellt…" : "OpenLDAP"}
                </Button>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      type="button"
                      disabled
                      className={cn(
                        "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium",
                        "border border-input bg-background text-foreground",
                        "h-10 px-3 opacity-60 cursor-not-allowed",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      )}
                    >
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      Entra ID
                    </TooltipTrigger>
                    <TooltipContent side="top" className="rounded-xl">
                      <p className="text-xs">Entra ID Lizenz erforderlich (Demnächst verfügbar)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}