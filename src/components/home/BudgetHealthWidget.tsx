// src/components/home/BudgetHealthWidget.tsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme, type Theme } from '@/theme';
import useBudgetStore, { type BudgetWithProgress } from '@/store/useBudgetStore';
import { formatCurrency } from '@/utils/formatCurrency';
import type { RootTabParamList } from '@/types/navigation';

type NavigationProp = NativeStackNavigationProp<RootTabParamList>;

export default function BudgetHealthWidget() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { getTopPressuredBudgets } = useBudgetStore();

  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get current month and year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Load top pressured budgets on mount
  useEffect(() => {
    const loadTopBudgets = async () => {
      setIsLoading(true);
      try {
        const topBudgets = await getTopPressuredBudgets(currentMonth, currentYear, 3);
        setBudgets(topBudgets);
      } finally {
        setIsLoading(false);
      }
    };

    loadTopBudgets();
  }, [getTopPressuredBudgets, currentMonth, currentYear]);

  // Get color for progress bar based on status
  const getStatusColor = (status: 'healthy' | 'warning' | 'exceeded'): string => {
    switch (status) {
      case 'healthy':
        return theme.colors.successMain;
      case 'warning':
        return theme.colors.warningMain;
      case 'exceeded':
        return theme.colors.dangerMain;
      default:
        return theme.colors.accentMain;
    }
  };

  // Format remaining amount label
  const getRemainingLabel = (remaining: number): string => {
    if (remaining >= 0) {
      return `${formatCurrency(remaining)} left`;
    } else {
      return `${formatCurrency(remaining)} over`;
    }
  };

  // Get color for remaining label
  const getRemainingColor = (remaining: number): string => {
    return remaining >= 0 ? theme.colors.textSecondary : theme.colors.dangerMain;
  };

  const makeStyles = (theme: Theme) =>
    StyleSheet.create({
      container: {
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.lg,
      },
      headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
      },
      header: {
        fontSize: theme.typography.fontSize.bodySmall,
        lineHeight: theme.typography.lineHeight.bodySmall,
        fontFamily: theme.typography.fontFamily.semibold,
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      },
      seeAllLink: {
        fontSize: theme.typography.fontSize.bodySmall,
        lineHeight: theme.typography.lineHeight.bodySmall,
        fontFamily: theme.typography.fontFamily.semibold,
        color: theme.colors.accentMain,
      },
      emptyContainer: {
        gap: theme.spacing.sm,
      },
      emptyText: {
        fontSize: theme.typography.fontSize.bodySmall,
        lineHeight: theme.typography.lineHeight.bodySmall,
        fontFamily: theme.typography.fontFamily.regular,
        color: theme.colors.textSecondary,
      },
      budgetRow: {
        marginBottom: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      },
      budgetRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
      },
      iconPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.bgInput,
      },
      budgetInfo: {
        flex: 1,
        justifyContent: 'center',
      },
      categoryName: {
        fontSize: theme.typography.fontSize.bodySmall,
        lineHeight: theme.typography.lineHeight.bodySmall,
        fontFamily: theme.typography.fontFamily.regular,
        color: theme.colors.textPrimary,
        marginBottom: theme.spacing.xs,
      },
      progressBarContainer: {
        height: 6,
        backgroundColor: theme.colors.border,
        borderRadius: theme.radius.full,
        overflow: 'hidden',
        flex: 1,
      },
      progressBar: {
        height: '100%',
        borderRadius: theme.radius.full,
      },
      remainingLabel: {
        fontSize: theme.typography.fontSize.caption,
        lineHeight: theme.typography.lineHeight.caption,
        fontFamily: theme.typography.fontFamily.regular,
        minWidth: 80,
        textAlign: 'right',
      },
    });

  const dynamicStyles = useMemo(() => makeStyles(theme), [theme]);

  // Handle "See all" navigation
  const handleSeeAll = () => {
    navigation.navigate('Plan', {
      screen: 'BudgetOverview',
    });
  };

  // Handle budget row navigation
  const handleBudgetPress = (categoryId: number) => {
    navigation.navigate('Plan', {
      screen: 'BudgetCategoryDetail',
      params: { categoryId, month: currentMonth, year: currentYear },
    });
  };

  // Handle "Set a budget" navigation
  const handleSetBudget = () => {
    navigation.navigate('Plan', {
      screen: 'BudgetOverview',
    });
  };

  // Empty state
  if (budgets.length === 0) {
    return (
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.headerContainer}>
          <Text style={dynamicStyles.header}>Budget health</Text>
        </View>
        <View style={dynamicStyles.emptyContainer}>
          <Text style={dynamicStyles.emptyText}>No budget limits set yet.</Text>
          <TouchableOpacity onPress={handleSetBudget} activeOpacity={0.7}>
            <Text style={dynamicStyles.seeAllLink}>Set a budget →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.headerContainer}>
        <Text style={dynamicStyles.header}>Budget health</Text>
        <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7}>
          <Text style={dynamicStyles.seeAllLink}>See all</Text>
        </TouchableOpacity>
      </View>

      {budgets.map((item) => {
        const statusColor = getStatusColor(item.status);
        const remainingLabel = getRemainingLabel(item.remaining);
        const remainingColor = getRemainingColor(item.remaining);
        const progressPercent = Math.min(item.percent / 100, 1);

        return (
          <TouchableOpacity
            key={`budget-${item.category.id}`}
            onPress={() => handleBudgetPress(item.category.id)}
            activeOpacity={0.7}
            style={dynamicStyles.budgetRow}
          >
            <View style={dynamicStyles.budgetRowContent}>
              <View style={dynamicStyles.iconPlaceholder} />
              <View style={dynamicStyles.budgetInfo}>
                <Text style={dynamicStyles.categoryName}>{item.category.name}</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                  }}
                >
                  <View style={[dynamicStyles.progressBarContainer, { flex: 2 }]}>
                    <View
                      style={[
                        dynamicStyles.progressBar,
                        {
                          width: `${progressPercent * 100}%`,
                          backgroundColor: statusColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
              <Text style={[dynamicStyles.remainingLabel, { color: remainingColor }]}>
                {remainingLabel}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
