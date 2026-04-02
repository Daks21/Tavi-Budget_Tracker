import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { WalletStackParamList } from '../../types/navigation';

import WalletListScreen from '../../screens/wallets/WalletListScreen';
import WalletDetailScreen from '../../screens/wallets/WalletDetailScreen';
import AddWalletScreen from '../../screens/wallets/AddWalletScreen';
import EditWalletScreen from '../../screens/wallets/EditWalletScreen';
import TransferScreen from '../../screens/wallets/TransferScreen';

const Stack = createNativeStackNavigator<WalletStackParamList>();

export default function WalletStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1B2B4B' },
        headerTintColor: '#FFFFFF',
        headerBackTitle: '',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="WalletList" component={WalletListScreen} options={{ title: 'Wallets' }} />
      <Stack.Screen name="WalletDetail" component={WalletDetailScreen} options={{ title: 'Wallet' }} />
      <Stack.Screen name="AddWallet" component={AddWalletScreen} options={{ title: 'Add Wallet' }} />
      <Stack.Screen name="EditWallet" component={EditWalletScreen} options={{ title: 'Edit Wallet' }} />
      <Stack.Screen name="Transfer" component={TransferScreen} options={{ title: 'Transfer' }} />
    </Stack.Navigator>
  );
}