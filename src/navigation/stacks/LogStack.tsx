import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { LogStackParamList } from '../../types/navigation';

import QuickLogScreen from '../../screens/log/QuickLogScreen';
import BatchLogScreen from '../../screens/log/BatchLogScreen';
import TransactionHistoryScreen from '../../screens/log/TransactionHistoryScreen';
import TransactionDetailScreen from '../../screens/log/TransactionDetailScreen';
import CalendarViewScreen from '../../screens/log/CalendarViewScreen';

const Stack = createNativeStackNavigator<LogStackParamList>();

export default function LogStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1B2B4B' },
        headerTintColor: '#FFFFFF',
        headerBackTitle: '',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="QuickLog" component={QuickLogScreen} options={{ title: 'Log' }} />
      <Stack.Screen name="BatchLog" component={BatchLogScreen} options={{ title: 'Batch Log' }} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} options={{ title: 'History' }} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: 'Transaction' }} />
      <Stack.Screen name="CalendarView" component={CalendarViewScreen} options={{ title: 'Calendar' }} />
    </Stack.Navigator>
  );
}