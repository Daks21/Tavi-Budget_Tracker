// src/screens/log/CalendarViewScreen.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { LogStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import CalendarView, { type TransactionSums } from '@/components/log/CalendarView';
import DayDetailSheet from '@/components/log/DayDetailSheet';
import useTransactionStore from '@/store/useTransactionStore';

type Props = NativeStackScreenProps<LogStackParamList, 'CalendarView'>;

export default function CalendarViewScreen(_props: Props) {
  
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return now.getMonth() + 1; // 1-12
  });

  const [year, setYear] = useState(() => {
    return new Date().getFullYear();
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetailVisible, setDayDetailVisible] = useState(false);

  const [transactionSums, setTransactionSums] = useState<Map<string, TransactionSums>>(
    new Map(),
  );
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);

  // Load transaction sums for the current month
  const loadMonthData = useCallback(async () => {
    setIsLoadingMonth(true);
    try {
      const sums = await useTransactionStore
        .getState()
        .getTransactionSumsByMonth(month, year);
      setTransactionSums(sums);
    } catch (error) {
      console.error('Failed to load month data:', error);
      setTransactionSums(new Map());
    } finally {
      setIsLoadingMonth(false);
    }
  }, [month, year]);

  // Load data on mount and when month/year changes
  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth);
    setYear(newYear);
  };

  const handleDaySelect = (dateString: string) => {
    setSelectedDate(dateString);
    setDayDetailVisible(true);
  };

  const handleCloseDayDetail = () => {
    setDayDetailVisible(false);
    // Keep selectedDate in state for highlighting, just close the sheet
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isLoadingMonth ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accentMain} />
        </View>
      ) : (
        <CalendarView
          month={month}
          year={year}
          onMonthChange={handleMonthChange}
          onDaySelect={handleDaySelect}
          selectedDate={selectedDate}
          transactionSums={transactionSums}
          isLoading={isLoadingMonth}
        />
      )}

      <DayDetailSheet
        visible={dayDetailVisible}
        selectedDate={selectedDate}
        onClose={handleCloseDayDetail}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgPage,
    },

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
