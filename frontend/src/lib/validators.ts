// src/lib/validators.ts
import { z } from "zod";

export const onboardingFormSchema = z.object({
  first_name: z.string().min(1, "Vorname ist erforderlich."),
  last_name: z.string().min(1, "Nachname ist erforderlich."),
  email: z.string().email("Ungültige E-Mail-Adresse."),
  department: z.string().min(1, "Abteilung ist erforderlich."),
  job_title: z.string().min(1, "Berufsbezeichnung ist erforderlich."),
  //provisioning_source: z.enum(["local", "ldap", "entra_id"]).default("ldap"),
});

export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;