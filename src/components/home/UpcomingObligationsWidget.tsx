import React, { useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme, type Theme } from '@/theme';
import useObligationStore from '@/store/useObligationStore';
import { formatCurrency } from '@/utils/formatCurrency';
import type { RootTabParamList } from '@/types/navigation';

type NavigationProp = NativeStackNavigationProp<RootTabParamList>;

export default function UpcomingObligationsWidget() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // Load obligations on mount
  const { upcomingPayments, loadObligations } = useObligationStore();
  useEffect(() => {
    loadObligations();
  }, [loadObligations]);

  // Filter to daysUntilDue <= 7, include overdue (negative), exclude paid
  const filteredPayments = useMemo(() => {
    return upcomingPayments
      .filter(
        (item) =>
          item.status !== 'paid' &&
          item.daysUntilDue !== null &&
          item.daysUntilDue <= 7
      )
      .sort((a, b) => {
        const aDays = a.daysUntilDue ?? 999;
        const bDays = b.daysUntilDue ?? 999;
        return aDays - bDays;
      });
  }, [upcomingPayments]);

  // Determine color for amount based on status
  const getAmountColor = (status: string): string => {
    switch (status) {
      case 'paid':
        return theme.colors.successMain;
      case 'due_soon':
        return theme.colors.dangerMain;
      case 'upcoming':
        return theme.colors.warningMain;
      case 'overdue':
        return theme.colors.dangerMain;
      default:
        return theme.colors.textPrimary;
    }
  };

  // Format days label
  const getDaysLabel = (daysUntilDue: number | null): string => {
    if (daysUntilDue === null) return '';
    if (daysUntilDue < 0) return 'Overdue';
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Tomorrow';
    return `In ${daysUntilDue} days`;
  };

  const makeStyles = (theme: Theme) =>
    StyleSheet.create({
      container: {
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.lg,
      },
      header: {
        fontSize: theme.typography.fontSize.heading2,
        lineHeight: theme.typography.lineHeight.heading2,
        fontFamily: theme.typography.fontFamily.semibold,
        color: theme.colors.textPrimary,
        marginBottom: theme.spacing.md,
      },
      emptyText: {
        fontSize: theme.typography.fontSize.bodySmall,
        lineHeight: theme.typography.lineHeight.bodySmall,
        fontFamily: theme.typography.fontFamily.regular,
        color: theme.colors.textSecondary,
      },
      cardContent: {
        backgroundColor: theme.colors.bgCard,
        width: 160,
        height: 90,
        padding: theme.spacing.md,
        borderRadius: theme.radius.medium,
        ...theme.shadows.card,
      },
      obligationName: {
        fontSize: theme.typography.fontSize.bodySmall,
        lineHeight: theme.typography.lineHeight.bodySmall,
        fontFamily: theme.typography.fontFamily.semibold,
        color: theme.colors.textPrimary,
        marginBottom: theme.spacing.sm,
      },
      amountText: {
        fontSize: theme.typography.fontSize.body,
        lineHeight: theme.typography.lineHeight.body,
        fontFamily: theme.typography.fontFamily.bold,
        marginBottom: theme.spacing.xs,
      },
      daysLabel: {
        fontSize: theme.typography.fontSize.bodySmall,
        lineHeight: theme.typography.lineHeight.bodySmall,
        fontFamily: theme.typography.fontFamily.regular,
        color: theme.colors.textSecondary,
      },
    });

  const dynamicStyles = useMemo(() => makeStyles(theme), [theme]);

  // Render card item
  const renderCard = ({ item }: any) => {
    const { obligation, status, daysUntilDue } = item;
    const amountColor = getAmountColor(status);
    const daysLabel = getDaysLabel(daysUntilDue);

    return (
      <TouchableOpacity
        onPress={() => {
          navigation.navigate('Plan', {
            screen: 'ObligationDetail',
            params: { obligationId: obligation.id },
          });
        }}
        activeOpacity={0.7}
        style={{ marginRight: theme.spacing.md }}
      >
        <View style={dynamicStyles.cardContent}>
          <Text
            numberOfLines={2}
            style={dynamicStyles.obligationName}
          >
            {obligation.name}
          </Text>
          <Text style={[dynamicStyles.amountText, { color: amountColor }]}>
            {formatCurrency(obligation.monthly_payment)}
          </Text>
          <Text style={dynamicStyles.daysLabel}>{daysLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (filteredPayments.length === 0) {
    return (
      <View style={dynamicStyles.container}>
        <Text style={dynamicStyles.header}>Coming up</Text>
        <Text style={dynamicStyles.emptyText}>
          No payments due in the next 7 days.
        </Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <Text style={dynamicStyles.header}>Coming up</Text>
      <FlatList
        data={filteredPayments}
        renderItem={renderCard}
        keyExtractor={(item) => `obligation-${item.obligation.id}`}
        horizontal
        scrollEnabled
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}
