// src/screens/log/TransactionHistoryScreen.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { Transaction, Account, Category } from '@/db/schema';
import db from '@/db';
import { categories } from '@/db/schema';
import AccountPicker from '@/components/common/AccountPicker';
import CategoryPicker from '@/components/common/CategoryPicker';
import CalendarView, { type TransactionSums } from '@/components/log/CalendarView';
import DayDetailSheet from '@/components/log/DayDetailSheet';

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

function EmptyState({
  theme,
  hasFilters,
  onClearFilters,
}: {
  theme: Theme;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  const icon = hasFilters ? 'search-outline' : 'receipt-outline';
  const title = hasFilters ? 'No transactions found' : 'Nothing logged yet';
  const subtitle = hasFilters ? 'No transactions match your filters.' : 'Start logging from the home screen.';

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        paddingHorizontal: theme.spacing.base,
        gap: theme.spacing.sm,
      }}
    >
      <Ionicons
        name={icon}
        size={48}
        color={theme.colors.textDisabled}
      />
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.typography.fontSize.bodyLarge,
          fontFamily: theme.typography.fontFamily.semibold,
          marginTop: theme.spacing.sm,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.body,
          fontFamily: theme.typography.fontFamily.regular,
          textAlign: 'center',
        }}
      >
        {subtitle}
      </Text>
      {hasFilters && (
        <TouchableOpacity
          onPress={onClearFilters}
          style={{ marginTop: theme.spacing.sm }}
        >
          <Text
            style={{
              color: theme.colors.accentMain,
              fontSize: theme.typography.fontSize.body,
              fontFamily: theme.typography.fontFamily.medium,
            }}
          >
            Clear filters
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ListFooter({
  isLoadingMore,
  hasMore,
  theme,
  onLoadMore,
}: {
  isLoadingMore: boolean;
  hasMore: boolean;
  theme: Theme;
  onLoadMore: () => void;
}) {
  if (!hasMore && !isLoadingMore) return null;

  if (isLoadingMore) {
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

  return (
    <View
      style={{
        paddingVertical: theme.spacing.lg,
        alignItems: 'center',
        paddingHorizontal: theme.spacing.base,
      }}
    >
      <TouchableOpacity
        onPress={onLoadMore}
        style={{
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.small,
        }}
      >
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.body,
            fontFamily: theme.typography.fontFamily.medium,
          }}
        >
          Load more
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function TransactionHistoryScreen({ navigation }: Props) {
  const theme = useTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);

  // View mode: list or calendar
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Type filter
  const [typeFilter, setTypeFilter] = useState<TransactionHistoryFilter['typeFilter']>('all');

  // Account and category filters
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Date range filters
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter sheet modal state
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [pendingStart, setPendingStart] = useState('');
  const [pendingEnd, setPendingEnd] = useState('');
  const [pendingAccountId, setPendingAccountId] = useState<number | null>(null);
  const [pendingCategoryId, setPendingCategoryId] = useState<number | null>(null);

  // Picker modals
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  // Local category map: id -> name
  const [categoryMap, setCategoryMap] = useState<Record<number, string>>({});
  const [accountMap, setAccountMap] = useState<Record<number, Account>>({});

  // Calendar view state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return now.getMonth() + 1; // 1-12
  });

  const [calendarYear, setCalendarYear] = useState(() => {
    return new Date().getFullYear();
  });

  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);
  const [dayDetailVisible, setDayDetailVisible] = useState(false);
  const [calendarTransactionSums, setCalendarTransactionSums] = useState<
    Map<string, TransactionSums>
  >(new Map());
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  const {
    allTransactions,
    isLoadingFiltered,
    isLoadingMore,
    hasMorePages,
    loadTransactionPage,
    setFilters,
    clearFilters,
    loadMoreTransactions,
  } = useTransactionStore();

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Load wallets/accounts for the map
  useEffect(() => {
    const wallets = useTransactionStore.getState().allTransactions || [];
    // Wallets info would come from useWalletStore, but for now we'll load from transactions
  }, []);

  // Load calendar month data
  useEffect(() => {
    const loadCalendarData = async () => {
      setIsLoadingCalendar(true);
      try {
        const sums = await useTransactionStore
          .getState()
          .getTransactionSumsByMonth(calendarMonth, calendarYear);
        setCalendarTransactionSums(sums);
      } catch (error) {
        console.error('Failed to load calendar data:', error);
        setCalendarTransactionSums(new Map());
      } finally {
        setIsLoadingCalendar(false);
      }
    };

    loadCalendarData();
  }, [calendarMonth, calendarYear]);

  // Reload when any filter changes (including debounced search)
  useEffect(() => {
    setFilters({
      typeFilter,
      accountId: selectedAccountId,
      categoryId: selectedCategoryId,
      dateStart: dateRangeStart,
      dateEnd: dateRangeEnd,
      searchQuery: debouncedSearchQuery,
    });
  }, [typeFilter, selectedAccountId, selectedCategoryId, dateRangeStart, dateRangeEnd, debouncedSearchQuery, setFilters]);

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
    if (hasMorePages && !isLoadingMore && !isLoadingFiltered) {
      loadMoreTransactions();
    }
  }, [hasMorePages, isLoadingMore, isLoadingFiltered, loadMoreTransactions]);

  const handleRowPress = useCallback(
    (transactionId: number) => {
      navigation.navigate('TransactionDetail', { transactionId });
    },
    [navigation],
  );

  // ── Filter sheet handlers ──────────────────────────────────────────────

  const openFilterSheet = useCallback(() => {
    setPendingStart(dateRangeStart ?? '');
    setPendingEnd(dateRangeEnd ?? '');
    setPendingAccountId(selectedAccountId);
    setPendingCategoryId(selectedCategoryId);
    setFilterSheetVisible(true);
  }, [dateRangeStart, dateRangeEnd, selectedAccountId, selectedCategoryId]);

  const applyFilters = useCallback(() => {
    setDateRangeStart(pendingStart.trim() || null);
    setDateRangeEnd(pendingEnd.trim() || null);
    setSelectedAccountId(pendingAccountId);
    setSelectedCategoryId(pendingCategoryId);
    setFilterSheetVisible(false);
  }, [pendingStart, pendingEnd, pendingAccountId, pendingCategoryId]);

  const clearAllFilters = useCallback(() => {
    setTypeFilter('all');
    setSelectedAccountId(null);
    setSelectedCategoryId(null);
    setDateRangeStart(null);
    setDateRangeEnd(null);
    setSearchQuery('');
    setFilterSheetVisible(false);
    clearFilters();
  }, [clearFilters]);

  const hasAdvancedFilters = Boolean(
    selectedAccountId || selectedCategoryId || dateRangeStart || dateRangeEnd || searchQuery
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with title and view toggle */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <TouchableOpacity
          onPress={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
          style={styles.viewToggle}
          accessibilityLabel={`Switch to ${viewMode === 'list' ? 'calendar' : 'list'} view`}
        >
          <Ionicons
            name={viewMode === 'list' ? 'calendar-outline' : 'list-outline'}
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Filter chips row */}
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
          onPress={openFilterSheet}
          style={[
            styles.advancedFilterButton,
            hasAdvancedFilters && styles.advancedFilterButtonActive,
          ]}
          accessibilityLabel="Advanced filters"
        >
          <Ionicons
            name="funnel-outline"
            size={18}
            color={hasAdvancedFilters ? theme.colors.accentMain : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.advancedFilterText,
              hasAdvancedFilters && styles.advancedFilterTextActive,
            ]}
          >
            Filter
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color={theme.colors.textSecondary}
          style={{ marginRight: theme.spacing.xs }}
        />
        <TextInput
          placeholder="Search transactions..."
          placeholderTextColor={theme.colors.textDisabled}
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="close-circle-outline"
              size={18}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Full-screen loader on first load */}
      {isLoadingFiltered ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accentMain} />
        </View>
      ) : viewMode === 'list' ? (
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
          ListEmptyComponent={
            <EmptyState
              theme={theme}
              hasFilters={hasAdvancedFilters}
              onClearFilters={clearAllFilters}
            />
          }
          ListFooterComponent={
            <ListFooter
              isLoadingMore={isLoadingMore}
              hasMore={hasMorePages}
              theme={theme}
              onLoadMore={handleEndReached}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          stickySectionHeadersEnabled
          contentContainerStyle={
            sections.length === 0 ? styles.emptyContent : undefined
          }
        />
      ) : (
        /* Calendar view */
        <>
          <CalendarView
            month={calendarMonth}
            year={calendarYear}
            onMonthChange={(newMonth, newYear) => {
              setCalendarMonth(newMonth);
              setCalendarYear(newYear);
            }}
            onDaySelect={(dateString) => {
              setCalendarSelectedDate(dateString);
              setDayDetailVisible(true);
            }}
            selectedDate={calendarSelectedDate}
            transactionSums={calendarTransactionSums}
            isLoading={isLoadingCalendar}
          />

          <DayDetailSheet
            visible={dayDetailVisible}
            selectedDate={calendarSelectedDate}
            onClose={() => setDayDetailVisible(false)}
          />
        </>
      )}

      {/* Filter Sheet Modal */}
      <Modal
        visible={filterSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.filterSheetOverlay}
          activeOpacity={1}
          onPress={() => setFilterSheetVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.filterSheet}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Sheet header */}
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Filters</Text>
              <TouchableOpacity
                onPress={() => setFilterSheetVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-outline"
                  size={24}
                  color={theme.colors.textPrimary}
                />
              </TouchableOpacity>
            </View>

            {/* Scrollable content */}
            <View style={styles.filterSheetContent}>
              {/* Account filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionLabel}>Account</Text>
                <TouchableOpacity
                  onPress={() => setAccountPickerVisible(true)}
                  style={styles.filterSelectButton}
                >
                  <Text style={styles.filterSelectButtonText}>
                    {pendingAccountId ? `Account ${pendingAccountId}` : 'All wallets'}
                  </Text>
                  <Ionicons
                    name="chevron-forward-outline"
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Category filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionLabel}>Category</Text>
                <TouchableOpacity
                  onPress={() => setCategoryPickerVisible(true)}
                  style={styles.filterSelectButton}
                >
                  <Text style={styles.filterSelectButtonText}>
                    {pendingCategoryId ? `Category ${pendingCategoryId}` : 'All categories'}
                  </Text>
                  <Ionicons
                    name="chevron-forward-outline"
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Date range */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionLabel}>Date Range</Text>
                <View style={styles.dateRangeInputs}>
                  <TextInput
                    placeholder="From"
                    placeholderTextColor={theme.colors.textDisabled}
                    value={pendingStart}
                    onChangeText={setPendingStart}
                    style={[styles.dateRangeInput, { flex: 1 }]}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  <Text style={styles.dateRangeSeparator}>–</Text>
                  <TextInput
                    placeholder="To"
                    placeholderTextColor={theme.colors.textDisabled}
                    value={pendingEnd}
                    onChangeText={setPendingEnd}
                    style={[styles.dateRangeInput, { flex: 1 }]}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.filterSheetActions}>
              <TouchableOpacity
                onPress={clearAllFilters}
                style={[styles.filterSheetBtn, styles.filterSheetBtnOutline]}
              >
                <Text style={styles.filterSheetBtnOutlineText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyFilters}
                style={[styles.filterSheetBtn, styles.filterSheetBtnFill]}
              >
                <Text style={styles.filterSheetBtnFillText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Account Picker */}
      <AccountPicker
        visible={accountPickerVisible}
        selectedAccountId={pendingAccountId}
        onSelect={(account) => {
          setPendingAccountId(account.id);
          setAccountPickerVisible(false);
        }}
        onClose={() => setAccountPickerVisible(false)}
      />

      {/* Category Picker */}
      <CategoryPicker
        visible={categoryPickerVisible}
        type="all"
        selectedCategoryId={pendingCategoryId}
        onSelect={(category) => {
          setPendingCategoryId(category.id);
          setCategoryPickerVisible(false);
        }}
        onClose={() => setCategoryPickerVisible(false)}
      />
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    headerTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.heading1,
      fontFamily: theme.typography.fontFamily.semibold,
      lineHeight: theme.typography.lineHeight.heading1,
      flex: 1,
    },
    viewToggle: {
      padding: theme.spacing.xs,
      borderRadius: theme.radius.small,
    },

    // Filter chips row
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingBottom: theme.spacing.sm,
      gap: theme.spacing.xs,
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
    // Advanced filter button
    advancedFilterButton: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs + 2,
      borderRadius: theme.radius.full,
      gap: theme.spacing.xs,
    },
    advancedFilterButtonActive: {
      backgroundColor: theme.colors.accentSubtle,
    },
    advancedFilterText: {
      fontSize: theme.typography.fontSize.bodySmall,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
    },
    advancedFilterTextActive: {
      color: theme.colors.accentMain,
    },

    // Search container
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.xs,
      marginHorizontal: theme.spacing.base,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.medium,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
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

    // Filter sheet modal
    filterSheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    filterSheet: {
      backgroundColor: theme.colors.bgCard,
      borderTopLeftRadius: theme.radius.large,
      borderTopRightRadius: theme.radius.large,
      paddingTop: theme.spacing.base,
      maxHeight: '80%',
      ...theme.shadows.modal,
    },
    filterSheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingBottom: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    filterSheetTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
    },
    filterSheetContent: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
    },
    filterSection: {
      marginBottom: theme.spacing.lg,
    },
    filterSectionLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.medium,
      marginBottom: theme.spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.label,
    },
    filterSelectButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.bgPage,
      borderRadius: theme.radius.small,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterSelectButtonText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      flex: 1,
    },
    dateRangeInputs: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    dateRangeInput: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.small,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.bgPage,
    },
    dateRangeSeparator: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.body,
    },
    filterSheetActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
      paddingBottom: theme.spacing.base,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.base,
    },
    filterSheetBtn: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.small,
      alignItems: 'center',
    },
    filterSheetBtnOutline: {
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterSheetBtnFill: {
      backgroundColor: theme.colors.brand,
    },
    filterSheetBtnOutlineText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
    },
    filterSheetBtnFillText: {
      color: theme.colors.textInverse,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
}
