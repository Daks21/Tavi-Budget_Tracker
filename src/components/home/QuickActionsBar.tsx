import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/theme';

type NavigationProp = NativeStackNavigationProp<any>;

export default function QuickActionsBar() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const makeStyles = (theme: any) =>
    StyleSheet.create({
      container: {
        flexDirection: 'row',
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.md,
        gap: theme.spacing.sm,
      },
      button: {
        flex: 1,
        backgroundColor: theme.colors.bgCard,
        borderRadius: theme.radius.medium,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.card,
      },
      iconContainer: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.spacing.xs,
      },
      label: {
        fontSize: theme.typography.fontSize.caption,
        lineHeight: theme.typography.lineHeight.caption,
        fontFamily: theme.typography.fontFamily.semibold,
        color: theme.colors.textSecondary,
      },
    });

  const dynamicStyles = useMemo(() => makeStyles(theme), [theme]);

  const handleExpense = () => {
    navigation.navigate('Log', {
      screen: 'QuickLog',
      params: { prefillType: 'expense' },
    });
  };

  const handleIncome = () => {
    navigation.navigate('Log', {
      screen: 'QuickLog',
      params: { prefillType: 'income' },
    });
  };

  const handleTransfer = () => {
    navigation.navigate('Wallets', {
      screen: 'Transfer',
    });
  };

  const handleBatch = () => {
    navigation.navigate('Log', {
      screen: 'BatchLog',
    });
  };

  return (
    <View style={dynamicStyles.container}>
      {/* Expense */}
      <TouchableOpacity
        style={dynamicStyles.button}
        onPress={handleExpense}
        activeOpacity={0.7}
      >
        <View style={dynamicStyles.iconContainer}>
          <Ionicons
            name="remove-circle"
            size={24}
            color={theme.colors.dangerMain}
          />
        </View>
        <Text style={dynamicStyles.label}>Expense</Text>
      </TouchableOpacity>

      {/* Income */}
      <TouchableOpacity
        style={dynamicStyles.button}
        onPress={handleIncome}
        activeOpacity={0.7}
      >
        <View style={dynamicStyles.iconContainer}>
          <Ionicons
            name="add-circle"
            size={24}
            color={theme.colors.successMain}
          />
        </View>
        <Text style={dynamicStyles.label}>Income</Text>
      </TouchableOpacity>

      {/* Transfer */}
      <TouchableOpacity
        style={dynamicStyles.button}
        onPress={handleTransfer}
        activeOpacity={0.7}
      >
        <View style={dynamicStyles.iconContainer}>
          <Ionicons
            name="swap-horizontal"
            size={24}
            color={theme.colors.accentMain}
          />
        </View>
        <Text style={dynamicStyles.label}>Transfer</Text>
      </TouchableOpacity>

      {/* Batch */}
      <TouchableOpacity
        style={dynamicStyles.button}
        onPress={handleBatch}
        activeOpacity={0.7}
      >
        <View style={dynamicStyles.iconContainer}>
          <Ionicons
            name="list"
            size={24}
            color={theme.colors.warningMain}
          />
        </View>
        <Text style={dynamicStyles.label}>Batch</Text>
      </TouchableOpacity>
    </View>
  );
}
