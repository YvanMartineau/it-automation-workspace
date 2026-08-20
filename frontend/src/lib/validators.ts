// src/lib/validators.ts
import { z } from "zod";

export const onboardingFormSchema = z.object({
  first_name: z.string().min(2, "Vorname muss mindestens 2 Zeichen lang sein."),
  last_name: z.string().min(2, "Nachname muss mindestens 2 Zeichen lang sein."),
  email: z.string().email("Ungültige E-Mail-Adresse."),
  department: z.string().min(2, "Abteilung ist erforderlich."),
  job_title: z.string().min(2, "Berufsbezeichnung ist erforderlich."),
  provisioning_source: z.enum(["local", "ldap", "entra_id"]).default("local"),
});

export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;