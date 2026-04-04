// src/screens/log/TransactionHistoryScreen.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { inArray } from 'drizzle-orm';

import type { LogStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useTransactionStore, {
  type TransactionHistoryFilter,
} from '@/store/useTransactionStore';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Transaction } from '@/db/schema';
import db from '@/db';
import { categories } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<LogStackParamList, 'TransactionHistory'>;

type FilterChip = {
  label: string;
  value: TransactionHistoryFilter['typeFilter'];
};

type Section = {
  title: string;
  data: Transaction[];
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const FILTER_CHIPS: FilterChip[] = [
  { label: 'All',       value: 'all'      },
  { label: 'Expenses',  value: 'expense'  },
  { label: 'Income',    value: 'income'   },
  { label: 'Transfers', value: 'transfer' },
];

const DAY_NAMES  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_NAMES  = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─────────────────────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateHeader(dateStr: string): string {
  const today     = todayStr();
  const yesterday = yesterdayStr();
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';

  // Parse 'YYYY-MM-DD' without timezone shift
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]}, ${MON_NAMES[date.getMonth()]} ${d}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP TRANSACTIONS BY DATE
// ─────────────────────────────────────────────────────────────────────────────

function groupByDate(txs: Transaction[]): Section[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const existing = map.get(tx.date);
    if (existing) {
      existing.push(tx);
    } else {
      map.set(tx.date, [tx]);
    }
  }
  return Array.from(map.entries()).map(([date, data]) => ({
    title: formatDateHeader(date),
    data,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// AMOUNT DISPLAY
// ─────────────────────────────────────────────────────────────────────────────

function amountLabel(tx: Transaction): string {
  if (tx.type === 'income')   return `+${formatCurrency(tx.amount)}`;
  if (tx.type === 'expense')  return `-${formatCurrency(tx.amount)}`;
  return `→${formatCurrency(tx.amount)}`;
}

function amountColor(tx: Transaction, theme: Theme): string {
  if (tx.type === 'income')  return theme.colors.accentMain;
  if (tx.type === 'expense') return theme.colors.dangerMain;
  return theme.colors.textSecondary;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function TransactionRow({
  tx,
  theme,
  onPress,
  categoryName,
}: {
  tx: Transaction;
  theme: Theme;
  onPress: () => void;
  categoryName: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.md,
        backgroundColor: theme.colors.bgCard,
        gap: theme.spacing.md,
      }}
    >
      {/* Icon placeholder */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.medium,
          backgroundColor: theme.colors.accentSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={
            tx.type === 'income'
              ? 'arrow-down-circle-outline'
              : tx.type === 'transfer'
              ? 'swap-horizontal-outline'
              : 'arrow-up-circle-outline'
          }
          size={20}
          color={theme.colors.accentMain}
        />
      </View>

      {/* Center */}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.body,
              fontFamily: theme.typography.fontFamily.medium,
              lineHeight: theme.typography.lineHeight.body,
              flexShrink: 1,
            }}
          >
            {tx.description ?? tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
          </Text>

          {tx.entry_mode === 'batch' && (
            <View
              style={{
                backgroundColor: theme.colors.accentSubtle,
                borderRadius: theme.radius.small,
                paddingHorizontal: theme.spacing.xs,
                paddingVertical: 1,
              }}
            >
              <Text
                style={{
                  color: theme.colors.accentMain,
                  fontSize: theme.typography.fontSize.label,
                  fontFamily: theme.typography.fontFamily.medium,
                }}
              >
                batch
              </Text>
            </View>
          )}
        </View>

        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.caption,
            fontFamily: theme.typography.fontFamily.regular,
            lineHeight: theme.typography.lineHeight.caption,
          }}
        >
          {categoryName}
        </Text>
      </View>

      {/* Amount */}
      <Text
        style={{
          color: amountColor(tx, theme),
          fontSize: theme.typography.fontSize.body,
          fontFamily: theme.typography.fontFamily.semibold,
          lineHeight: theme.typography.lineHeight.body,
        }}
      >
        {amountLabel(tx)}
      </Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, theme }: { title: string; theme: Theme }) {
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.base,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xs,
        backgroundColor: theme.colors.bgPage,
      }}
    >
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.caption,
          fontFamily: theme.typography.fontFamily.medium,
          textTransform: 'uppercase',
          letterSpacing: theme.typography.letterSpacing.label,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function EmptyState({ theme }: { theme: Theme }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        gap: theme.spacing.sm,
      }}
    >
      <Ionicons
        name="receipt-outline"
        size={48}
        color={theme.colors.textDisabled}
      />
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.typography.fontSize.bodyLarge,
          fontFamily: theme.typography.fontFamily.semibold,
          marginTop: theme.spacing.sm,
        }}
      >
        No transactions yet.
      </Text>
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.body,
          fontFamily: theme.typography.fontFamily.regular,
        }}
      >
        Start logging...
      </Text>
    </View>
  );
}

function ListFooter({
  isLoadingMore,
  theme,
}: {
  isLoadingMore: boolean;
  theme: Theme;
}) {
  if (!isLoadingMore) return null;
  return (
    <View
      style={{
        paddingVertical: theme.spacing.lg,
        alignItems: 'center',
      }}
    >
      <ActivityIndicator size="small" color={theme.colors.accentMain} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function TransactionHistoryScreen({ navigation }: Props) {
  const theme = useTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [typeFilter, setTypeFilter] = useState<TransactionHistoryFilter['typeFilter']>('all');
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null);
  const [dateRangeEnd,   setDateRangeEnd]   = useState<string | null>(null);

  // Date range modal state
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [pendingStart, setPendingStart] = useState('');
  const [pendingEnd,   setPendingEnd]   = useState('');

  // Local category map: id -> name
  const [categoryMap, setCategoryMap] = useState<Record<number, string>>({});

  const {
    allTransactions,
    isLoadingAll,
    isLoadingMore,
    hasMore,
    loadAllTransactions,
    loadMoreTransactions,
  } = useTransactionStore();

  // Reload when any filter changes
  useEffect(() => {
    loadAllTransactions({ typeFilter, dateRangeStart, dateRangeEnd });
  }, [typeFilter, dateRangeStart, dateRangeEnd]);

  // Load category names for the visible transactions
  useEffect(() => {
    const ids = [
      ...new Set(
        allTransactions
          .map((tx) => tx.category_id)
          .filter((id): id is number => id != null),
      ),
    ];

    if (ids.length === 0) {
      setCategoryMap({});
      return;
    }

    db.select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(inArray(categories.id, ids))
      .then((rows) => {
        const map: Record<number, string> = {};
        for (const row of rows) {
          map[row.id] = row.name;
        }
        setCategoryMap(map);
      })
      .catch(() => {});
  }, [allTransactions]);

  const sections = useMemo(() => groupByDate(allTransactions), [allTransactions]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore && !isLoadingAll) {
      loadMoreTransactions();
    }
  }, [hasMore, isLoadingMore, isLoadingAll, loadMoreTransactions]);

  const handleRowPress = useCallback(
    (transactionId: number) => {
      navigation.navigate('TransactionDetail', { transactionId });
    },
    [navigation],
  );

  // ── Date range modal handlers ──────────────────────────────────────────────

  const openDateModal = useCallback(() => {
    setPendingStart(dateRangeStart ?? '');
    setPendingEnd(dateRangeEnd ?? '');
    setDateModalVisible(true);
  }, [dateRangeStart, dateRangeEnd]);

  const applyDateRange = useCallback(() => {
    setDateRangeStart(pendingStart.trim() || null);
    setDateRangeEnd(pendingEnd.trim() || null);
    setDateModalVisible(false);
  }, [pendingStart, pendingEnd]);

  const clearDateRange = useCallback(() => {
    setDateRangeStart(null);
    setDateRangeEnd(null);
    setPendingStart('');
    setPendingEnd('');
    setDateModalVisible(false);
  }, []);

  const hasDateFilter = Boolean(dateRangeStart || dateRangeEnd);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
      </View>

      {/* Filter chips + date range icon in same row */}
      <View style={styles.filterRow}>
        {FILTER_CHIPS.map((chip) => {
          const active = chip.value === typeFilter;
          return (
            <TouchableOpacity
              key={chip.value}
              onPress={() => setTypeFilter(chip.value)}
              activeOpacity={0.7}
              style={[
                styles.chip,
                active ? styles.chipActive : styles.chipInactive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  active ? styles.chipTextActive : styles.chipTextInactive,
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          onPress={openDateModal}
          style={[styles.dateIconButton, hasDateFilter && styles.dateIconButtonActive]}
          accessibilityLabel="Filter by date range"
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={hasDateFilter ? theme.colors.accentMain : theme.colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Full-screen loader on first load */}
      {isLoadingAll ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accentMain} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TransactionRow
              tx={item}
              theme={theme}
              categoryName={
                item.category_id != null
                  ? (categoryMap[item.category_id] ?? item.type)
                  : item.type
              }
              onPress={() => handleRowPress(item.id)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} theme={theme} />
          )}
          ListEmptyComponent={<EmptyState theme={theme} />}
          ListFooterComponent={
            <ListFooter isLoadingMore={isLoadingMore} theme={theme} />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          stickySectionHeadersEnabled
          contentContainerStyle={
            sections.length === 0 ? styles.emptyContent : undefined
          }
        />
      )}

      {/* Date range modal */}
      <Modal
        visible={dateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDateModalVisible(false)}
        >
          {/* Inner touchable stops tap-through so tapping the card doesn't close */}
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Date Range</Text>

            <Text style={styles.modalLabel}>Start date</Text>
            <TextInput
              value={pendingStart}
              onChangeText={setPendingStart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textDisabled}
              style={styles.modalInput}
              keyboardType="numeric"
              maxLength={10}
              autoCorrect={false}
            />

            <Text style={styles.modalLabel}>End date</Text>
            <TextInput
              value={pendingEnd}
              onChangeText={setPendingEnd}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textDisabled}
              style={styles.modalInput}
              keyboardType="numeric"
              maxLength={10}
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={clearDateRange}
                style={[styles.modalBtn, styles.modalBtnOutline]}
              >
                <Text style={styles.modalBtnOutlineText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyDateRange}
                style={[styles.modalBtn, styles.modalBtnFill]}
              >
                <Text style={styles.modalBtnFillText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

    // Header
    header: {
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    headerTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.heading1,
      fontFamily: theme.typography.fontFamily.semibold,
      lineHeight: theme.typography.lineHeight.heading1,
    },

    // Filter chips row
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    chip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs + 2,
      borderRadius: theme.radius.full,
      borderWidth: 1,
    },
    chipActive: {
      backgroundColor: theme.colors.brand,
      borderColor: theme.colors.brand,
    },
    chipInactive: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.border,
    },
    chipText: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.medium,
    },
    chipTextActive: {
      color: theme.colors.textInverse,
    },
    chipTextInactive: {
      color: theme.colors.textSecondary,
    },
    dateIconButton: {
      marginLeft: 'auto',
      padding: theme.spacing.xs,
      borderRadius: theme.radius.small,
    },
    dateIconButtonActive: {
      backgroundColor: theme.colors.accentSubtle,
    },

    // Loading / empty
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContent: {
      flexGrow: 1,
    },

    // Date range modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
    },
    modalCard: {
      width: '100%',
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.medium,
      padding: theme.spacing.base,
      gap: theme.spacing.sm,
    },
    modalTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      marginBottom: theme.spacing.xs,
    },
    modalLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.medium,
      marginTop: theme.spacing.xs,
    },
    modalInput: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.small,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    modalActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.small,
      alignItems: 'center',
    },
    modalBtnOutline: {
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalBtnFill: {
      backgroundColor: theme.colors.brand,
    },
    modalBtnOutlineText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
    },
    modalBtnFillText: {
      color: theme.colors.textInverse,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
}
