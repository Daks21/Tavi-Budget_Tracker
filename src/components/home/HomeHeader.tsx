import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/theme';
import useWalletStore from '@/store/useWalletStore';
import usePrivacyMode from '@/hooks/usePrivacyMode';
import db from '@/db';
import { userProfile } from '@/db/schema';
import { getTotalPersonalBalance, getMonthlyIncome } from '@/utils/calculations';
import { formatBalanceDisplay } from '@/utils/formatCurrency';

type NavigationProp = NativeStackNavigationProp<any>;

export default function HomeHeader() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // Store data
  const accounts = useWalletStore((state) => state.accounts);

  // Privacy mode
  const { isPrivate, toggle: togglePrivacy } = usePrivacyMode();

  // Local state
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [userProfile_, setUserProfile] = useState<any>(null);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Greeting — recompute on every render to stay fresh
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning.';
    if (hour >= 12 && hour < 17) return 'Good afternoon.';
    if (hour >= 17 && hour < 21) return 'Good evening.';
    return 'Good night.';
  })();

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);

      // Get user profile
      const profileRows = await db
        .select()
        .from(userProfile)
        .limit(1);
      if (profileRows.length > 0) {
        setUserProfile(profileRows[0]);
      }

      // Get total balance
      const balance = await getTotalPersonalBalance(accounts);
      setTotalBalance(balance);

      // Get monthly income for irregular users
      const now = new Date();
      if (profileRows.length > 0 && profileRows[0].income_type === 'irregular') {
        const monthly = await getMonthlyIncome(
          now.getMonth() + 1,
          now.getFullYear()
        );
        setMonthlyIncome(monthly);
      }
    } catch (error) {
      console.error('Error loading home header data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadData();
  }, [accounts]);

  // Refresh on focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [accounts])
  );

  // Helper: get last valid day of a month
  const getLastDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // Compute payday info with month-end edge case handling
  const paydayInfo = useMemo(() => {
    if (!userProfile_ || userProfile_.income_type !== 'regular') {
      return null;
    }

    if (!userProfile_.payday_date) {
      return {
        type: 'notSet',
      };
    }

    const today = new Date();
    const currentDay = today.getDate();
    const paydayDate = userProfile_.payday_date;

    // Clamp payday to valid day of the month
    const lastDayThisMonth = getLastDayOfMonth(today);
    const validPaydayThisMonth = Math.min(paydayDate, lastDayThisMonth);

    let daysUntilPayday: number;

    if (currentDay < validPaydayThisMonth) {
      // Payday is later this month
      daysUntilPayday = validPaydayThisMonth - currentDay;
      return {
        type: 'set',
        daysUntilPayday,
        isToday: false,
      };
    } else if (currentDay === validPaydayThisMonth) {
      // Today is payday
      return {
        type: 'set',
        daysUntilPayday: 0,
        isToday: true,
      };
    } else {
      // Payday is next month
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const lastDayNextMonth = getLastDayOfMonth(nextMonth);
      const validPaydayNextMonth = Math.min(paydayDate, lastDayNextMonth);

      const daysLeftThisMonth = lastDayThisMonth - currentDay;
      daysUntilPayday = daysLeftThisMonth + validPaydayNextMonth;

      return {
        type: 'set',
        daysUntilPayday,
        isToday: false,
      };
    }
  }, [userProfile_]);

  // Render persona widget
  const renderPersonaWidget = () => {
    if (!userProfile_) {
      return null;
    }

    if (userProfile_.income_type === 'regular') {
      if (!paydayInfo) {
        return null;
      }

      if (paydayInfo.type === 'notSet') {
        return (
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('More', { screen: 'Settings' });
            }}
          >
            <Text
              style={[
                styles.personaText,
                {
                  color: theme.colors.textInverse,
                  fontSize: theme.typography.fontSize.bodySmall,
                  lineHeight: theme.typography.lineHeight.bodySmall,
                  fontFamily: theme.typography.fontFamily.regular,
                  opacity: 0.65,
                },
              ]}
            >
              Set your payday date in Settings
            </Text>
          </TouchableOpacity>
        );
      }

      if (paydayInfo.isToday) {
        return (
          <Text
            style={[
              styles.personaText,
              {
                color: theme.colors.textInverse,
                fontSize: theme.typography.fontSize.bodySmall,
                lineHeight: theme.typography.lineHeight.bodySmall,
                fontFamily: theme.typography.fontFamily.regular,
                opacity: 0.65,
              },
            ]}
          >
            Payday today.
          </Text>
        );
      }

      return (
        <Text
          style={[
            styles.personaText,
            {
              color: theme.colors.textInverse,
              fontSize: theme.typography.fontSize.bodySmall,
              lineHeight: theme.typography.lineHeight.bodySmall,
              fontFamily: theme.typography.fontFamily.regular,
              opacity: 0.65,
            },
          ]}
        >
          Payday in {paydayInfo.daysUntilPayday} days.
        </Text>
      );
    }

    // Irregular income
    return (
      <Text
        style={[
          styles.personaText,
          {
            color: theme.colors.textInverse,
            fontSize: theme.typography.fontSize.bodySmall,
            lineHeight: theme.typography.lineHeight.bodySmall,
            fontFamily: theme.typography.fontFamily.regular,
            opacity: 0.65,
          },
        ]}
      >
        Income this month: ₱
        {monthlyIncome.toLocaleString('en-PH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </Text>
    );
  };

  const makeStyles = (theme: any) =>
    StyleSheet.create({
      container: {
        backgroundColor: theme.colors.brand,
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        paddingBottom: theme.spacing.xl,
      },
      greeting: {
        color: theme.colors.textInverse,
        fontSize: theme.typography.fontSize.body,
        lineHeight: theme.typography.lineHeight.body,
        fontFamily: theme.typography.fontFamily.regular,
        opacity: 0.75,
        marginBottom: theme.spacing.lg,
      },
      balanceLabel: {
        color: theme.colors.textInverse,
        fontSize: theme.typography.fontSize.bodySmall,
        lineHeight: theme.typography.lineHeight.bodySmall,
        fontFamily: theme.typography.fontFamily.regular,
        marginBottom: theme.spacing.sm,
      },
      balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
      },
      balanceAmount: {
        color: theme.colors.textInverse,
        fontSize: theme.typography.fontSize.display,
        lineHeight: theme.typography.lineHeight.display,
        fontFamily: theme.typography.fontFamily.bold,
      },
      privacyIcon: {
        marginLeft: theme.spacing.sm,
        color: theme.colors.textInverse,
      },
    });

  const dynamicStyles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={dynamicStyles.container}>
      {/* Greeting */}
      <Text style={dynamicStyles.greeting}>{greeting}</Text>

      {/* Balance */}
      <Text style={dynamicStyles.balanceLabel}>Total Balance</Text>

      {loading ? (
        <ActivityIndicator color={theme.colors.textInverse} size="small" />
      ) : (
        <View style={dynamicStyles.balanceContainer}>
          <Text style={dynamicStyles.balanceAmount}>
            {formatBalanceDisplay(totalBalance, isPrivate)}
          </Text>
          <TouchableOpacity
            onPress={() => {
              togglePrivacy();
            }}
          >
            <Ionicons
              name={isPrivate ? 'eye-off' : 'eye'}
              size={20}
              style={[
                dynamicStyles.privacyIcon,
                {
                  opacity: isPrivate ? 1 : 0.7,
                },
              ]}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Persona widget */}
      {!loading && renderPersonaWidget()}
    </View>
  );
}

const styles = StyleSheet.create({
  personaText: {
    marginTop: 0,
  },
});
