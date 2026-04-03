// src/navigation/index.ts

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { OnboardingCompleteProvider } from '@/context/OnboardingCompleteContext';
import db from '@/db';
import { userProfile } from '@/db/schema';
import OnboardingStack from '@/navigation/stacks/OnboardingStack';
import TabNavigator from '@/navigation/TabNavigator';

type OnboardingState = boolean | null;
// null  = still checking DB
// false = show onboarding
// true  = show tabs

export default function RootNavigator() {
  const [isOnboardingComplete, setIsOnboardingComplete] =
    useState<OnboardingState>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkOnboardingStatus() {
      try {
        const rows = await db.select().from(userProfile).limit(1);
        const done = rows.length > 0 && rows[0].onboarding_done === 1;

        if (!cancelled) {
          setIsOnboardingComplete(done);
        }
      } catch (error) {
        console.warn('[RootNavigator] Could not read userProfile:', error);

        if (!cancelled) {
          setIsOnboardingComplete(false);
        }
      }
    }

    checkOnboardingStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const completeOnboarding = useCallback(() => {
    setIsOnboardingComplete(true);
  }, []);

  if (isOnboardingComplete === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#38BFA7" />
      </View>
    );
  }

  if (isOnboardingComplete === false) {
    return (
      <OnboardingCompleteProvider value={{ completeOnboarding }}>
        <OnboardingStack />
      </OnboardingCompleteProvider>
    );
  }

  return <TabNavigator />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#1B2B4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
});