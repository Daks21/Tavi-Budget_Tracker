import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import usePrivacyMode from '@/hooks/usePrivacyMode';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import useWalletStore from '@/store/useWalletStore';
import {
  getAllAccountBalances,
  getTotalBusinessBalance,
  getTotalPersonalBalance,
} from '@/utils/calculations';
import { formatBalanceDisplay } from '@/utils/formatCurrency';
import { useTheme } from '@/theme';
import type { Account } from '@/db/schema';
import type { WalletStackParamList } from '@/types/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation prop type
// ─────────────────────────────────────────────────────────────────────────────
type Props = NativeStackScreenProps<WalletStackParamList, 'WalletList'>;

// ─────────────────────────────────────────────────────────────────────────────
// Local types
// ─────────────────────────────────────────────────────────────────────────────
type BalanceLoadState = 'idle' | 'loading' | 'done' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT — WalletListScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function WalletListScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { accounts, isLoading, loadAccounts } = useWalletStore();
  const { isPrivate, toggle } = usePrivacyMode();

  const [balanceMap, setBalanceMap] = useState<Map<number, number>>(new Map());
  const [totalPersonal, setTotalPersonal] = useState<number>(0);
  const [totalBusiness, setTotalBusiness] = useState<number>(0);
  const [balanceState, setBalanceState] = useState<BalanceLoadState>('idle');

  // ── Load accounts + compute all balances ──────────────────────────────────
  const loadAll = useCallback(async () => {
    setBalanceState('loading');
    try {
      await loadAccounts();

      // useWalletStore.getState() reads fresh store state outside React closure
      const fresh = useWalletStore.getState().accounts;

      const [map, personal, business] = await Promise.all([
        getAllAccountBalances(fresh.map((a) => a.id)),
        getTotalPersonalBalance(fresh),
        getTotalBusinessBalance(fresh),
      ]);

      setBalanceMap(map);
      setTotalPersonal(personal);
      setTotalBusiness(business);
      setBalanceState('done');
    } catch {
      setBalanceState('error');
    }
  }, [loadAccounts]);

  // ── Reload whenever this screen comes into focus ───────────────────────────
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const hasBusinessWallets = accounts.some(
    (a) =>
      (a.category === 'business' || a.category === 'lending_fund') &&
      a.is_active === 1
  );

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.bgPage}
      />

      <FlatList
        data={accounts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.listContent,
          accounts.length === 0 && styles.listContentEmpty,
        ]}
        ListHeaderComponent={
          <SummaryCard
            totalPersonal={totalPersonal}
            totalBusiness={hasBusinessWallets ? totalBusiness : null}
            privacyMode={isPrivate}
            balanceState={balanceState}
            onTogglePrivacy={toggle}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              onAddWallet={() => navigation.navigate('AddWallet')}
            />
          )
        }
        renderItem={({ item }) => (
          <WalletCard
            account={item}
            balance={balanceMap.get(item.id)}
            balanceState={balanceState}
            privacyMode={isPrivate}
            onPress={() =>
              navigation.navigate('WalletDetail', { accountId: item.id })
            }
          />
        )}
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => navigation.navigate('AddWallet')}
        accessibilityLabel="Add wallet"
        accessibilityRole="button"
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT — SummaryCard
// ─────────────────────────────────────────────────────────────────────────────
interface SummaryCardProps {
  totalPersonal: number;
  totalBusiness: number | null;   // null = no business wallets exist
  privacyMode: boolean;
  balanceState: BalanceLoadState;
  onTogglePrivacy: () => void;
}

function SummaryCard({
  totalPersonal,
  totalBusiness,
  privacyMode,
  balanceState,
  onTogglePrivacy,
}: SummaryCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeSummaryStyles(theme), [theme]);

  const isLoading = balanceState === 'loading' || balanceState === 'idle';

  return (
    <View style={styles.card}>
      {/* Row: label + privacy toggle */}
      <View style={styles.header}>
        <Text style={styles.label}>Total Balance</Text>
        <Pressable
          onPress={onTogglePrivacy}
          accessibilityLabel={privacyMode ? 'Show balances' : 'Hide balances'}
          accessibilityRole="button"
          hitSlop={12}
        >
          <Text style={styles.eyeIcon}>{privacyMode ? '🙈' : '👁'}</Text>
        </Pressable>
      </View>

      {/* Main total — personal balance only */}
      {isLoading ? (
        <BalanceSkeleton width={140} height={36} />
      ) : (
        <Text style={styles.totalAmount}>
          {formatBalanceDisplay(totalPersonal, privacyMode)}
        </Text>
      )}

      {/*
        Business sub-row — only when business wallets exist.
        FIX: shows both Personal AND Business with their respective values.
        The total line above is personal only; this row breaks it down.
      */}
      {totalBusiness !== null && (
        <View style={styles.subRow}>
          {/* Personal sub-value */}
          <View style={styles.subItem}>
            <Text style={styles.subLabel}>Personal</Text>
            {isLoading ? (
              <BalanceSkeleton width={56} height={14} />
            ) : (
              <Text style={styles.subValue}>
                {formatBalanceDisplay(totalPersonal, privacyMode)}
              </Text>
            )}
          </View>

          {/* Business sub-value */}
          <View style={styles.subItem}>
            <Text style={styles.subLabel}>Business</Text>
            {isLoading ? (
              <BalanceSkeleton width={56} height={14} />
            ) : (
              <Text style={styles.subValue}>
                {formatBalanceDisplay(totalBusiness, privacyMode)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Privacy mode notice */}
      {privacyMode && (
        <Text style={styles.privacyNote}>
          Balances hidden. Tap the eye to show.
        </Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT — WalletCard
// ─────────────────────────────────────────────────────────────────────────────
interface WalletCardProps {
  account: Account;
  balance: number | undefined;
  balanceState: BalanceLoadState;
  privacyMode: boolean;
  onPress: () => void;
}

function WalletCard({
  account,
  balance,
  balanceState,
  privacyMode,
  onPress,
}: WalletCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeCardStyles(theme), [theme]);

  const isLoading = balanceState === 'loading' || balanceState === 'idle';
  const hasError = balanceState === 'error' || balance === undefined;
  const accountTypeLabel = ACCOUNT_TYPE_LABELS[account.type] ?? account.type;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${account.name} wallet`}
    >
      {/* Icon placeholder — replaced with real asset in Module 3.6 */}
      <View style={styles.iconCircle} />

      {/* Name + type label */}
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {account.name}
        </Text>
        <Text style={styles.type}>{accountTypeLabel}</Text>
      </View>

      {/* Balance — skeleton while loading, warning icon on error */}
      <View style={styles.balanceCol}>
        {isLoading ? (
          <BalanceSkeleton width={72} height={18} />
        ) : hasError ? (
          <Text style={styles.errorIcon}>⚠</Text>
        ) : (
          <Text style={styles.balance}>
            {formatBalanceDisplay(balance!, privacyMode)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT — EmptyState
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ onAddWallet }: { onAddWallet: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeEmptyStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {/* Mascot placeholder — replace with real asset in Module 3.6 */}
      <View style={styles.mascot} />

      <Text style={styles.heading}>No wallets yet.</Text>
      <Text style={styles.subtext}>
        Add your first wallet to start tracking your money.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={onAddWallet}
      >
        <Text style={styles.buttonLabel}>Add Wallet</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT — BalanceSkeleton
// Grey placeholder that prevents ₱0.00 flash while balances load.
// ─────────────────────────────────────────────────────────────────────────────
function BalanceSkeleton({ width, height }: { width: number; height: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width,
        height,
        borderRadius: height / 2,
        backgroundColor: theme.colors.border,
        opacity: 0.5,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: 'Cash',
  ewallet: 'E-Wallet',
  bank: 'Bank Account',
  credit_card: 'Credit Card',
  virtual_fund: 'Virtual Fund',
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLE FACTORIES — accept theme, return StyleSheet
// Each factory is called inside its component via useMemo.
// Using theme.typography.fontSize.X and theme.typography.fontFamily.X
// pattern throughout, matching the project's token structure.
// ─────────────────────────────────────────────────────────────────────────────
type Theme = ReturnType<typeof useTheme>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.bgPage,
    },
    listContent: {
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.base,
      paddingBottom: theme.spacing.huge, // clears the FAB
      gap: theme.spacing.sm,
    },
    listContentEmpty: {
      flexGrow: 1,
    },
    fab: {
      position: 'absolute',
      bottom: theme.spacing.xxl,
      right: theme.spacing.xl,
      width: 56,
      height: 56,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accentMain,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.modal,
    },
    fabPressed: {
      opacity: 0.85,
    },
    fabIcon: {
      fontSize: 28,
      color: theme.colors.textInverse,
      lineHeight: 32,
    },
  });
}

function makeSummaryStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.large,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing.base,
      ...theme.shadows.card,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    label: {
      fontSize: theme.typography.fontSize.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    eyeIcon: {
      fontSize: 18,
    },
    totalAmount: {
      fontSize: theme.typography.fontSize.display,
      lineHeight: theme.typography.lineHeight.display,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    // Business breakdown row — shows Personal value + Business value side by side
    subRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    subItem: {
      gap: 2,
    },
    subLabel: {
      fontSize: theme.typography.fontSize.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
    },
    subValue: {
      fontSize: theme.typography.fontSize.bodySmall,
      lineHeight: theme.typography.lineHeight.bodySmall,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
    },
    privacyNote: {
      marginTop: theme.spacing.sm,
      fontSize: theme.typography.fontSize.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
    },
  });
}

function makeCardStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.bgCard,
      borderRadius: theme.radius.medium,
      padding: theme.spacing.base,
      gap: theme.spacing.md,
      ...theme.shadows.card,
    },
    cardPressed: {
      opacity: 0.7,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accentSubtle,
    },
    meta: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontSize: theme.typography.fontSize.bodyLarge,
      lineHeight: theme.typography.lineHeight.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
    },
    type: {
      fontSize: theme.typography.fontSize.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
    },
    balanceCol: {
      alignItems: 'flex-end',
      minWidth: 80,
    },
    balance: {
      fontSize: theme.typography.fontSize.bodyLarge,
      lineHeight: theme.typography.lineHeight.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
    },
    errorIcon: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.dangerMain,
    },
  });
}

function makeEmptyStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xxl,
      paddingTop: theme.spacing.xxxl,
      gap: theme.spacing.md,
    },
    mascot: {
      width: 96,
      height: 96,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accentSubtle,
      marginBottom: theme.spacing.base,
    },
    heading: {
      fontSize: theme.typography.fontSize.heading2,
      lineHeight: theme.typography.lineHeight.heading2,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    subtext: {
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    button: {
      marginTop: theme.spacing.base,
      backgroundColor: theme.colors.accentMain,
      borderRadius: theme.radius.medium,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
    },
    buttonPressed: {
      opacity: 0.8,
    },
    buttonLabel: {
      fontSize: theme.typography.fontSize.bodyLarge,
      lineHeight: theme.typography.lineHeight.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textInverse,
    },
  });
}