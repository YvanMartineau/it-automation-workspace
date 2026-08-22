// src/components/onboarding/OnboardingJobStreamSubscriber.tsx
import { useOnboardingJobStream } from "#/hooks/useOnboarding";

interface Props {
  jobId: string;
  active: boolean;
}

export function OnboardingJobStreamSubscriber({ jobId, active }: Props) {
  useOnboardingJobStream(jobId, active);
  return null;
}
