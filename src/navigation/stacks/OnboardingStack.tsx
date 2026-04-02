import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../types/navigation';

import WelcomeScreen from '../../screens/onboarding/WelcomeScreen';
import PersonaSelectScreen from '../../screens/onboarding/PersonaSelectScreen';
import AddWalletScreen from '../../screens/onboarding/AddWalletScreen';
import AddMoreWalletsScreen from '../../screens/onboarding/AddMoreWalletsScreen';
import FirstDashboardScreen from '../../screens/onboarding/FirstDashboardScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="PersonaSelect" component={PersonaSelectScreen} />
      <Stack.Screen name="AddWallet" component={AddWalletScreen} />
      <Stack.Screen name="AddMoreWallets" component={AddMoreWalletsScreen} />
      <Stack.Screen name="FirstDashboard" component={FirstDashboardScreen} />
    </Stack.Navigator>
  );
}