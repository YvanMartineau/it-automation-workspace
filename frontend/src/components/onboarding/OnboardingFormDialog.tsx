// src/components/onboarding/OnboardingFormDialog.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "#/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "#/components/ui/form"; // Assume standard shadcn form
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
      name: "",
      department: "",
      role: "",
      source: "local_db",
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
      <DialogTrigger
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Onboarding starten
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neuen Onboarding-Vorgang erstellen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vollständiger Name</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Max Mustermann" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abteilung</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Engineering" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rolle / Position</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Software Engineer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Wird erstellt..." : "Lokal erstellen (DB)"}
              </Button>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full opacity-60 cursor-not-allowed"
                        disabled
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Entra ID
                      </Button>
                    </div>
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