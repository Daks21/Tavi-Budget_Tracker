import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import db from '../db';
import { userProfile } from '../db/schema';
import OnboardingStack from './stacks/OnboardingStack';
import TabNavigator from './TabNavigator';

type NavState = 'loading' | 'onboarding' | 'main';

export default function RootNavigator() {
  const [navState, setNavState] = useState<NavState>('loading');

  useEffect(() => {
    let isMounted = true;

    async function checkOnboarding() {
      try {
        const profiles = await db.select().from(userProfile).limit(1);

        if (!isMounted) return;

        if (profiles.length === 0 || profiles[0].onboarding_done === 0) {
          setNavState('onboarding');
        } else {
          setNavState('main');
        }
      } catch (error) {
        console.error('[Nav] Failed to check onboarding state:', error);
        if (isMounted) setNavState('onboarding');
      }
    }

    checkOnboarding();

    return () => {
      isMounted = false;
    };
  }, []);

  if (navState === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#38BFA7" />
      </View>
    );
  }

  if (navState === 'onboarding') {
    return <OnboardingStack />;
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