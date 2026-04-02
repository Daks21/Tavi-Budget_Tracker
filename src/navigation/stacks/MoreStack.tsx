import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MoreStackParamList, ModuleStackParamList } from '../../types/navigation';

import SettingsScreen from '../../screens/more/SettingsScreen';
import NotificationSettingsScreen from '../../screens/more/NotificationSettingsScreen';
import BackupRestoreScreen from '../../screens/more/BackupRestoreScreen';
import DataExportScreen from '../../screens/more/DataExportScreen';
import AboutScreen from '../../screens/more/AboutScreen';
import ModuleActivationScreen from '../../screens/more/ModuleActivationScreen';

import LendingDashboardScreen from '../../screens/modules/LendingDashboardScreen';
import BorrowerDetailScreen from '../../screens/modules/BorrowerDetailScreen';
import AddBorrowerScreen from '../../screens/modules/AddBorrowerScreen';
import LoanDetailScreen from '../../screens/modules/LoanDetailScreen';
import AddLoanScreen from '../../screens/modules/AddLoanScreen';
import LogCollectionScreen from '../../screens/modules/LogCollectionScreen';
import PaluwaganGroupScreen from '../../screens/modules/PaluwaganGroupScreen';
import BuySellLedgerScreen from '../../screens/modules/BuySellLedgerScreen';
import UtangTrackerScreen from '../../screens/modules/UtangTrackerScreen';

type MoreNavigatorParamList = MoreStackParamList & ModuleStackParamList;

const Stack = createNativeStackNavigator<MoreNavigatorParamList>();

export default function MoreStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1B2B4B' },
        headerTintColor: '#FFFFFF',
        headerBackTitle: '',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} options={{ title: 'Backup & Restore' }} />
      <Stack.Screen name="DataExport" component={DataExportScreen} options={{ title: 'Export Data' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
      <Stack.Screen name="ModuleActivation" component={ModuleActivationScreen} options={{ title: 'Modules' }} />

      <Stack.Screen name="LendingDashboard" component={LendingDashboardScreen} options={{ title: 'Lending Dashboard' }} />
      <Stack.Screen name="BorrowerDetail" component={BorrowerDetailScreen} options={{ title: 'Borrower' }} />
      <Stack.Screen name="AddBorrower" component={AddBorrowerScreen} options={{ title: 'Add Borrower' }} />
      <Stack.Screen name="LoanDetail" component={LoanDetailScreen} options={{ title: 'Loan' }} />
      <Stack.Screen name="AddLoan" component={AddLoanScreen} options={{ title: 'Add Loan' }} />
      <Stack.Screen name="LogCollection" component={LogCollectionScreen} options={{ title: 'Log Collection' }} />
      <Stack.Screen name="PaluwaganGroup" component={PaluwaganGroupScreen} options={{ title: 'Paluwagan Group' }} />
      <Stack.Screen name="BuySellLedger" component={BuySellLedgerScreen} options={{ title: 'Buy & Sell' }} />
      <Stack.Screen name="UtangTracker" component={UtangTrackerScreen} options={{ title: 'Utang Tracker' }} />
    </Stack.Navigator>
  );
}