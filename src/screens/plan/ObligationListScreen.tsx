// src/screens/plan/ObligationListScreen.tsx

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import type { PlanStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useObligationStore, { type ObligationWithStatus } from '@/store/useObligationStore';
import { formatCurrency } from '@/utils/formatCurrency';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<PlanStackParamList, 'ObligationList'>;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  credit_card: 'card-outline',
  personal_loan: 'cash-outline',
  bank_loan: 'business-outline',
  bnpl: 'phone-portrait-outline',
  installment: 'receipt-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${SHORT_MONTHS[monthIndex]} ${day}`;
}

type BadgeInfo = {
  label: string;
  bgKey: keyof Theme['colors'];
  textKey: keyof Theme['colors'];
};

function getBadgeInfo(item: ObligationWithStatus): BadgeInfo {
  const { status, daysUntilDue, nextPayment } = item;

  if (status === 'paid') {
    return { label: 'Paid', bgKey: 'successSubtle', textKey: 'successMain' };
  }

  if (status === 'overdue') {
    const overdueDays = daysUntilDue !== null ? Math.abs(daysUntilDue) : 0;
    return {
      label: `Overdue ${overdueDays} days`,
      bgKey: 'dangerSubtle',
      textKey: 'dangerMain',
    };
  }

  if (status === 'due_soon') {
    let label = '';
    if (daysUntilDue === 0) {
      label = 'Due today';
    } else if (daysUntilDue === 1) {
      label = 'Due tomorrow';
    } else {
      label = `Due in ${daysUntilDue} days`;
    }
    return { label, bgKey: 'dangerSubtle', textKey: 'dangerMain' };
  }

  // upcoming
  const dateLabel = nextPayment ? formatShortDate(nextPayment.scheduled_date) : '';
  return {
    label: dateLabel ? `Due ${dateLabel}` : 'Upcoming',
    bgKey: 'warningSubtle',
    textKey: 'warningMain',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OBLIGATION CARD
// ─────────────────────────────────────────────────────────────────────────────

function ObligationCard({
  item,
  theme,
  s,
  onPress,
}: {
  item: ObligationWithStatus;
  theme: Theme;
  s: ReturnType<typeof makeStyles>;
  onPress: () => void;
}) {
  const { obligation, nextPayment } = item;
  const iconName = TYPE_ICON[obligation.type] ?? 'ellipsis-horizontal-circle-outline';
  const badge = getBadgeInfo(item);
  const dueDateLabel = nextPayment ? formatShortDate(nextPayment.scheduled_date) : null;

  return (
    <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={onPress}>
      <View style={s.cardRow}>
        {/* Left icon */}
        <View style={s.iconContainer}>
          <Ionicons name={iconName} size={22} color={theme.colors.accentMain} />
        </View>

        {/* Body */}
        <View style={s.cardBody}>
          <Text style={s.obligationName} numberOfLines={1}>
            {obligation.name}
          </Text>
          <Text style={s.obligationAmount}>
            {formatCurrency(obligation.monthly_payment)}/month
          </Text>
          <Text style={s.nextDueText}>
            Next: {dueDateLabel !== null ? dueDateLabel : '—'}
          </Text>
        </View>

        {/* Badge */}
        <View
          style={[
            s.badge,
            { backgroundColor: theme.colors[badge.bgKey] as string },
          ]}
        >
          <Text
            style={[
              s.badgeText,
              { color: theme.colors[badge.textKey] as string },
            ]}
          >
            {badge.label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function ObligationListScreen({ navigation }: Props) {
  const theme = useTheme();
  const s = useMemo(() => makeStyles(theme), [theme]);

  const loadObligations = useObligationStore((st) => st.loadObligations);
  const getTotalMonthlyBurden = useObligationStore((st) => st.getTotalMonthlyBurden);
  const upcomingPayments = useObligationStore((st) => st.upcomingPayments);
  const obligations = useObligationStore((st) => st.obligations);
  const isLoading = useObligationStore((st) => st.isLoading);

  const [totalMonthly, setTotalMonthly] = useState(0);

  async function loadData() {
    await loadObligations();
    const burden = await getTotalMonthlyBurden();
    setTotalMonthly(burden);
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // ── Section splitting ───────────────────────────────────────────────────────

  const dueSoon = upcomingPayments.filter(
    (item) =>
      item.daysUntilDue !== null &&
      item.daysUntilDue <= 7 &&
      item.status !== 'paid',
  );

  const allSorted = [...upcomingPayments].sort((a, b) => {
    if (a.daysUntilDue === null && b.daysUntilDue === null) return 0;
    if (a.daysUntilDue === null) return 1;
    if (b.daysUntilDue === null) return -1;
    return a.daysUntilDue - b.daysUntilDue;
  });

  const isEmpty = !isLoading && upcomingPayments.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Screen header */}
      <Text style={s.screenHeader}>Obligations</Text>

      {/* Summary card */}
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>Total monthly obligations</Text>
        <Text style={s.summaryAmount}>{formatCurrency(totalMonthly)}</Text>
        <Text style={s.summarySubtext}>
          across {obligations.length} active obligation
          {obligations.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator color={theme.colors.accentMain} />
        </View>
      ) : isEmpty ? (
        <View style={s.emptyState}>
          <View style={s.mascotPlaceholder} />
          <Text style={s.emptyTitle}>No obligations tracked yet.</Text>
          <Text style={s.emptySubtitle}>
            Add your CC bills, loans, or installment plans to see what's coming up.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Due soon section */}
          <Text style={s.sectionHeader}>Due soon</Text>
          {dueSoon.length === 0 ? (
            <Text style={s.emptySection}>No payments due in the next 7 days.</Text>
          ) : (
            dueSoon.map((item) => (
              <ObligationCard
                key={item.obligation.id}
                item={item}
                theme={theme}
                s={s}
                onPress={() =>
                  navigation.navigate('ObligationDetail', {
                    obligationId: item.obligation.id,
                  })
                }
              />
            ))
          )}

          {/* All obligations section */}
          <Text style={[s.sectionHeader, { marginTop: theme.spacing.base }]}>
            All obligations
          </Text>
          {allSorted.length === 0 ? (
            <Text style={s.emptySection}>No obligations yet.</Text>
          ) : (
            allSorted.map((item) => (
              <ObligationCard
                key={item.obligation.id}
                item={item}
                theme={theme}
                s={s}
                onPress={() =>
                  navigation.navigate('ObligationDetail', {
                    obligationId: item.obligation.id,
                  })
                }
              />
            ))
          )}

          <View style={{ height: theme.spacing.huge }} />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation.navigate('AddObligation')}
        activeOpacity={0.85}
      >
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgPage,
    },

    // ── Screen header ───────────────────────────────────────────────────────
    screenHeader: {
      fontSize: theme.typography.fontSize.heading1,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.colors.textPrimary,
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.base,
      paddingBottom: theme.spacing.xs,
    },

    // ── Summary card ────────────────────────────────────────────────────────
    summaryCard: {
      backgroundColor: theme.colors.bgCard,
      marginHorizontal: theme.spacing.base,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.base,
      borderRadius: theme.radius.large,
      padding: theme.spacing.base,
      alignItems: 'center',
      ...theme.shadows.card,
    },
    summaryTitle: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    summaryAmount: {
      fontSize: theme.typography.fontSize.heading1,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    summarySubtext: {
      fontSize: theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
    },

    // ── Loading ─────────────────────────────────────────────────────────────
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Empty state ─────────────────────────────────────────────────────────
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
    },
    mascotPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.bgInput,
      marginBottom: theme.spacing.base,
    },
    emptyTitle: {
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: theme.typography.lineHeight.body,
    },

    // ── Scroll ──────────────────────────────────────────────────────────────
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.base,
    },

    // ── Section header ──────────────────────────────────────────────────────
    sectionHeader: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.label,
      marginBottom: theme.spacing.sm,
    },
    emptySection: {
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textDisabled,
      marginBottom: theme.spacing.base,
    },

    // ── Obligation card ─────────────────────────────────────────────────────
    card: {
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.large,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.card,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.medium,
      backgroundColor: theme.colors.accentSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
      flexShrink: 0,
    },
    cardBody: {
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    obligationName: {
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
    },
    obligationAmount: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    nextDueText: {
      fontSize: theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textDisabled,
      marginTop: 2,
    },

    // ── Status badge ────────────────────────────────────────────────────────
    badge: {
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      alignSelf: 'flex-start',
      flexShrink: 0,
    },
    badgeText: {
      fontSize: theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.semibold,
    },

    // ── FAB ─────────────────────────────────────────────────────────────────
    fab: {
      position: 'absolute',
      right: theme.spacing.base,
      bottom: theme.spacing.base,
      width: 52,
      height: 52,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.modal,
    },
    fabText: {
      fontSize: 28,
      color: theme.colors.textInverse,
      fontFamily: theme.typography.fontFamily.regular,
      lineHeight: 32,
    },
  });
}
