// src/components/log/CalendarView.tsx

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, type Theme } from '@/theme';
import { formatCurrency } from '@/utils/formatCurrency';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

const CELL_SIZE = 44;

export interface TransactionSums {
  income: number;
  expense: number;
}

interface DayObject {
  day: number | null; // null for padding cells
  dateString: string | null;
  isToday: boolean;
  isFuture: boolean;
  hasIncome: boolean;
  hasExpense: boolean;
}

interface CalendarViewProps {
  month: number; // 1-12
  year: number;
  onMonthChange: (month: number, year: number) => void;
  onDaySelect: (dateString: string) => void;
  selectedDate: string | null;
  transactionSums: Map<string, TransactionSums>;
  isLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MON_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateCalendarDays(month: number, year: number): DayObject[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDay = new Date(year, month, 0).getDate();

  const days: DayObject[] = [];
  const today = todayStr();

  // Padding cells before first day
  for (let i = 0; i < firstDay; i++) {
    days.push({
      day: null,
      dateString: null,
      isToday: false,
      isFuture: false,
      hasIncome: false,
      hasExpense: false,
    });
  }

  // Days of the month
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const isFuture = new Date(dateStr) > new Date(today);

    days.push({
      day: d,
      dateString: dateStr,
      isToday,
      isFuture,
      hasIncome: false,
      hasExpense: false,
    });
  }

  return days;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function MonthHeader({
  month,
  year,
  theme,
  onPrevMonth,
  onNextMonth,
}: {
  month: number;
  year: number;
  theme: Theme;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const styles = makeStyles(theme);

  return (
    <View style={styles.monthHeader}>
      <TouchableOpacity
        onPress={onPrevMonth}
        style={styles.navButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="chevron-back"
          size={24}
          color={theme.colors.textPrimary}
        />
      </TouchableOpacity>

      <Text style={styles.monthTitle}>
        {MON_NAMES[month - 1]} {year}
      </Text>

      <TouchableOpacity
        onPress={onNextMonth}
        style={styles.navButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="chevron-forward"
          size={24}
          color={theme.colors.textPrimary}
        />
      </TouchableOpacity>
    </View>
  );
}

function DayLabels({ theme, cellSize }: { theme: Theme; cellSize: number }) {
  const styles = makeStyles(theme);

  return (
    <View style={styles.dayLabelsRow}>
      {DAY_LABELS.map((label) => (
        <View
          key={label}
          style={[styles.dayLabelCell, { width: cellSize, height: cellSize * 0.6 }]}
        >
          <Text style={styles.dayLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function DayCell({
  dayObj,
  theme,
  isSelected,
  onPress,
  cellSize,
}: {
  dayObj: DayObject;
  theme: Theme;
  isSelected: boolean;
  onPress: () => void;
  cellSize: number;
}) {
  const styles = makeStyles(theme);

  if (dayObj.day === null) {
    return <View style={[styles.dayCell, { width: cellSize, height: cellSize }]} />;
  }

  const textColor = dayObj.isFuture ? theme.colors.textDisabled : theme.colors.textPrimary;

  return (
    <TouchableOpacity
      style={[styles.dayCell, { width: cellSize, height: cellSize }]}
      onPress={onPress}
      disabled={dayObj.isFuture}
      activeOpacity={0.7}
    >
      {/* Day number with background circle if today or selected */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: dayObj.isToday
            ? theme.colors.accentMain
            : isSelected
            ? theme.colors.brand
            : 'transparent',
        }}
      >
        <Text
          style={{
            color: dayObj.isToday || isSelected ? theme.colors.textInverse : textColor,
            fontSize: theme.typography.fontSize.body,
            fontFamily: theme.typography.fontFamily.medium,
          }}
        >
          {dayObj.day}
        </Text>
      </View>

      {/* Indicator dots */}
      {!dayObj.isFuture && (dayObj.hasExpense || dayObj.hasIncome) && (
        <View
          style={{
            flexDirection: 'row',
            gap: 1,
            marginTop: 4,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {dayObj.hasExpense && (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.colors.dangerSoft,
              }}
            />
          )}
          {dayObj.hasIncome && (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.colors.accentSoft,
              }}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function MonthlySummary({
  month,
  year,
  transactionSums,
  theme,
}: {
  month: number;
  year: number;
  transactionSums: Map<string, TransactionSums>;
  theme: Theme;
}) {
  const styles = makeStyles(theme);

  const monthKeys = Array.from(transactionSums.keys()).filter((key) => {
    const [y, m] = key.split('-').map(Number);
    return y === year && m === month;
  });

  let totalIncome = 0;
  let totalExpense = 0;

  for (const key of monthKeys) {
    const sums = transactionSums.get(key);
    if (sums) {
      totalIncome += sums.income;
      totalExpense += sums.expense;
    }
  }

  const net = totalIncome - totalExpense;

  return (
    <View style={styles.monthlySummary}>
      <Text style={styles.monthlySummaryText}>
        This month: +{formatCurrency(totalIncome)} in, -{formatCurrency(totalExpense)} out
      </Text>
      <Text
        style={[
          styles.netAmount,
          {
            color: net >= 0 ? theme.colors.accentMain : theme.colors.dangerMain,
          },
        ]}
      >
        {formatCurrency(Math.abs(net))}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR VIEW COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CalendarView({
  month,
  year,
  onMonthChange,
  onDaySelect,
  selectedDate,
  transactionSums,
  isLoading,
}: CalendarViewProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const screenWidth = Dimensions.get('window').width;
  const cellSize = useMemo(
    () => (screenWidth - theme.spacing.base * 2) / 7,
    [screenWidth, theme.spacing.base],
  );

  const days = useMemo(
    () => generateCalendarDays(month, year),
    [month, year],
  );

  // Populate income/expense flags for each day
  const enrichedDays = days.map((day) => {
    if (!day.dateString) return day;

    const sums = transactionSums.get(day.dateString);
    return {
      ...day,
      hasIncome: sums ? sums.income > 0 : false,
      hasExpense: sums ? sums.expense > 0 : false,
    };
  });

  const handlePrevMonth = () => {
    if (month === 1) {
      onMonthChange(12, year - 1);
    } else {
      onMonthChange(month - 1, year);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      onMonthChange(1, year + 1);
    } else {
      onMonthChange(month + 1, year);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        {/* Month header */}
        <MonthHeader
          month={month}
          year={year}
          theme={theme}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Month header */}
      <MonthHeader
        month={month}
        year={year}
        theme={theme}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      {/* Day labels row */}
      <DayLabels theme={theme} cellSize={cellSize} />

      {/* Calendar grid */}
      <FlatList
        scrollEnabled={false}
        data={enrichedDays}
        keyExtractor={(_, index) => String(index)}
        numColumns={7}
        columnWrapperStyle={{ flexDirection: 'row' }}
        renderItem={({ item }) => (
          <DayCell
            dayObj={item}
            theme={theme}
            isSelected={item.dateString === selectedDate}
            onPress={() => {
              if (item.dateString && !item.isFuture) {
                onDaySelect(item.dateString);
              }
            }}
            cellSize={cellSize}
          />
        )}
        scrollIndicatorInsets={{ right: 1 }}
      />

      {/* Monthly summary */}
      <MonthlySummary
        month={month}
        year={year}
        transactionSums={transactionSums}
        theme={theme}
      />
    </View>
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
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
    },

    loadingContainer: {
      flex: 1,
      backgroundColor: theme.colors.bgPage,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
    },

    // Month header
    monthHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },

    monthTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      lineHeight: theme.typography.lineHeight.bodyLarge,
    },

    navButton: {
      padding: theme.spacing.xs,
    },

    // Day labels
    dayLabelsRow: {
      flexDirection: 'row',
      marginBottom: theme.spacing.sm,
    },

    dayLabelCell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: CELL_SIZE * 0.6,
    },

    dayLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.caption,
      fontFamily: theme.typography.fontFamily.medium,
    },

    // Day cells
    dayCell: {
      height: CELL_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xs,
    },

    // Monthly summary
    monthlySummary: {
      marginTop: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.medium,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    monthlySummaryText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      marginBottom: theme.spacing.xs,
    },

    netAmount: {
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      lineHeight: theme.typography.lineHeight.bodyLarge,
    },
  });
}
