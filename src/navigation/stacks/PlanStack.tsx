import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PlanStackParamList } from '../../types/navigation';

import BudgetOverviewScreen from '../../screens/plan/BudgetOverviewScreen';
import BudgetCategoryDetailScreen from '../../screens/plan/BudgetCategoryDetailScreen';
import ObligationListScreen from '../../screens/plan/ObligationListScreen';
import ObligationDetailScreen from '../../screens/plan/ObligationDetailScreen';
import AddObligationScreen from '../../screens/plan/AddObligationScreen';
import SavingsGoalListScreen from '../../screens/plan/SavingsGoalListScreen';
import AddSavingsGoalScreen from '../../screens/plan/AddSavingsGoalScreen';
import RecurringRulesScreen from '../../screens/plan/RecurringRulesScreen';
import AddRecurringRuleScreen from '../../screens/plan/AddRecurringRuleScreen';

const Stack = createNativeStackNavigator<PlanStackParamList>();

export default function PlanStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1B2B4B' },
        headerTintColor: '#FFFFFF',
        headerBackTitle: '',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="BudgetOverview" component={BudgetOverviewScreen} options={{ title: 'Plan' }} />
      <Stack.Screen name="BudgetCategoryDetail" component={BudgetCategoryDetailScreen} options={{ title: 'Budget' }} />
      <Stack.Screen name="ObligationList" component={ObligationListScreen} options={{ title: 'Obligations' }} />
      <Stack.Screen name="ObligationDetail" component={ObligationDetailScreen} options={{ title: 'Obligation' }} />
      <Stack.Screen name="AddObligation" component={AddObligationScreen} options={{ title: 'Add Obligation' }} />
      <Stack.Screen name="SavingsGoalList" component={SavingsGoalListScreen} options={{ title: 'Savings Goals' }} />
      <Stack.Screen name="AddSavingsGoal" component={AddSavingsGoalScreen} options={{ title: 'Add Goal' }} />
      <Stack.Screen name="RecurringRules" component={RecurringRulesScreen} options={{ title: 'Recurring' }} />
      <Stack.Screen name="AddRecurringRule" component={AddRecurringRuleScreen} options={{ title: 'Add Recurring' }} />
    </Stack.Navigator>
  );
}