// src/components/onboarding/OnboardingFormDialog.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "#/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form";
import { Input } from "#/components/ui/input";
import { Button } from "#/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip";
import { Plus, Lock } from "lucide-react";
import { onboardingFormSchema, type OnboardingFormValues } from "#/lib/validators";
import { useCreateOnboarding } from "#/hooks/useOnboarding";

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
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
        <Plus className="mr-2 h-4 w-4" />
        Onboarding starten
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Neuen Onboarding-Vorgang erstellen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vorname</FormLabel>
                    <FormControl><Input placeholder="Max" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nachname</FormLabel>
                    <FormControl><Input placeholder="Mustermann" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl><Input type="email" placeholder="max.mustermann@company.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abteilung</FormLabel>
                    <FormControl><Input placeholder="Engineering" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="job_title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Berufsbezeichnung</FormLabel>
                    <FormControl><Input placeholder="Software Engineer" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-3 pt-2">
              {/* Primary Submit Button */}
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Wird erstellt..." : "Lokal erstellen (DB)"}
              </Button>
              
              <TooltipProvider>
                <Tooltip>
                  {/* No asChild. We style the Trigger directly to act as the button. */}
                  <TooltipTrigger 
                    className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 opacity-60 cursor-not-allowed"
                    disabled
                    aria-disabled="true"
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Entra ID
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Entra ID Lizenz erforderlich (Demnächst verfügbar)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}