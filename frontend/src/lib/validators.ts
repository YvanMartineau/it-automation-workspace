// src/lib/validators.ts
import { z } from "zod";

export const onboardingFormSchema = z.object({
  name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein."),
  department: z.string().min(2, "Abteilung ist erforderlich."),
  role: z.string().min(2, "Rolle ist erforderlich."),
  // Future-proofed: defaults to local_db for now
  source: z.enum(["local_db", "entra_id"]).default("local_db"), 
});

export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;