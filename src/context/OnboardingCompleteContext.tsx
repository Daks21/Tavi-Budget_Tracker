import React, { createContext, useContext } from 'react';

type OnboardingCompleteContextValue = {
  completeOnboarding: () => void;
};

const OnboardingCompleteContext =
  createContext<OnboardingCompleteContextValue | null>(null);

export const OnboardingCompleteProvider = OnboardingCompleteContext.Provider;

export function useOnboardingComplete(): OnboardingCompleteContextValue {
  const ctx = useContext(OnboardingCompleteContext);
  if (!ctx) {
    throw new Error(
      '[Tavi] useOnboardingComplete must be used inside OnboardingCompleteProvider. ' +
        'Check that your root navigator wraps the onboarding stack with this provider (Step 2.1.8).',
    );
  }
  return ctx;
}