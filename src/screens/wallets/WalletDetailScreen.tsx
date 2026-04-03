// src/screens/wallets/WalletDetailScreen.tsx

import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { and, desc, eq } from 'drizzle-orm';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { WalletStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import { formatBalanceDisplay, formatCurrency } from '@/utils/formatCurrency';
import { getAccountBalance } from '@/utils/calculations';
import useWalletStore from '@/store/useWalletStore';
import db from '@/db';
import { useFocusEffect } from '@react-navigation/native';
import { transactions, categories } from '@/db/schema';

type Props = NativeStackScreenProps<WalletStackParamList, 'WalletDetail'>;

// ─── Types ────────────────────────────────────────────────────────────────────

type TransactionRow = {
  id: number;
  date: string;
  categoryName: string;
  description: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({
  label,
  theme,
}: {
  label: string;
  theme: Theme;
}) {
  return (
    <Text
      style={{
        color: theme.colors.textSecondary,
        fontSize: theme.typography.fontSize.label,
        fontFamily: theme.typography.fontFamily.medium,
        textTransform: 'uppercase',
        letterSpacing: theme.typography.letterSpacing.label,
        marginBottom: theme.spacing.sm,
      }}
    >
      {label}
    </Text>
  );
}

function DetailRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: Theme;
}) {
  return (
    <View
      style={[
        detailStyles.root,
        { borderBottomColor: theme.colors.border },
      ]}
    >
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.bodySmall,
          fontFamily: theme.typography.fontFamily.regular,
          flex: 1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.typography.fontSize.bodySmall,
          fontFamily: theme.typography.fontFamily.medium,
          flex: 1,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

function TransactionItem({
  item,
  isLast,
  theme,
}: {
  item: TransactionRow;
  isLast: boolean;
  theme: Theme;
}) {
  const isIncome = item.type === 'income';
  const isExpense = item.type === 'expense';

  const formattedDate = useMemo(() => {
    const d = new Date(item.date);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }, [item.date]);

  return (
    <View
      style={[
        txStyles.root,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <View style={txStyles.left}>
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.caption,
            fontFamily: theme.typography.fontFamily.regular,
            marginBottom: 2,
          }}
        >
          {formattedDate} · {item.categoryName}
        </Text>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.body,
            fontFamily: theme.typography.fontFamily.regular,
          }}
          numberOfLines={1}
        >
          {item.description || item.categoryName}
        </Text>
      </View>

      <Text
        style={{
          color: isIncome
            ? theme.colors.accentMain
            : isExpense
            ? theme.colors.dangerMain
            : theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.body,
          fontFamily: theme.typography.fontFamily.semibold,
          marginLeft: 12,
        }}
      >
        {isIncome ? '+' : isExpense ? '−' : ''}
        {formatCurrency(Math.abs(item.amount))}
      </Text>
    </View>
  );
}

const txStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  left: {
    flex: 1,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WalletDetailScreen({ route, navigation }: Props) {
  const { accountId } = route.params;
  const theme = useTheme();

  const account = useWalletStore((s) => s.getAccountById(accountId));
  const privacyMode = useWalletStore((s) => s.privacyMode);

  const [balance, setBalance] = useState<number>(0);
  const [recentTx, setRecentTx] = useState<TransactionRow[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  // ── Load balance and recent transactions ────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        setTxLoading(true);

        try {
          const [computedBalance, rows] = await Promise.all([
            getAccountBalance(accountId),
            db
              .select({
                id: transactions.id,
                date: transactions.date,
                amount: transactions.amount,
                type: transactions.type,
                description: transactions.description,
                categoryName: categories.name,
              })
              .from(transactions)
              .leftJoin(categories, eq(transactions.category_id, categories.id))
              .where(
                and(
                  eq(transactions.account_id, accountId),
                  eq(transactions.is_deleted, 0),
                )
              )
              .orderBy(desc(transactions.date))
              .limit(10),
          ]);

          if (cancelled) return;

          setBalance(computedBalance);
          setRecentTx(
            rows.map((row) => ({
              id: row.id,
              date: row.date,
              categoryName: row.categoryName ?? 'Uncategorized',
              description: row.description,
              amount: row.amount,
              type: row.type as TransactionRow['type'],
            })),
          );
        } catch (error) {
          console.error('[WalletDetail] load failed:', error);
        } finally {
          if (!cancelled) setTxLoading(false);
        }
      }

      load();

      return () => {
        cancelled = true;
      };
    }, [accountId])
  );

  // ── Header ──────────────────────────────────────────────────────────────────
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: account?.name ?? 'Wallet',
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('EditWallet', { accountId })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Edit wallet"
          style={{ paddingRight: 4 }}
        >
          <Text
            style={{
              color: theme.colors.accentMain,
              fontSize: theme.typography.fontSize.body,
              fontFamily: theme.typography.fontFamily.medium,
            }}
          >
            Edit
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, account?.name, accountId, theme]);

  if (!account) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.bgPage }]}
        edges={['bottom']}
      >
        <View style={styles.centeredState}>
          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.body,
              fontFamily: theme.typography.fontFamily.regular,
              textAlign: 'center',
            }}
          >
            Wallet not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const addedDate = account.created_at
    ? new Date(account.created_at).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  const categoryLabel =
    account.category === 'lending_fund'
      ? 'Lending Fund'
      : account.category
      ? account.category.charAt(0).toUpperCase() + account.category.slice(1)
      : '—';

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.bgPage }]}
      edges={['bottom']}
    >
      <StatusBar style="auto" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: theme.spacing.base },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Balance card ── */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.medium,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
              marginTop: theme.spacing.base,
              marginBottom: theme.spacing.lg,
              paddingHorizontal: 20,
              paddingVertical: 24,
            },
          ]}
        >
          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.caption,
              fontFamily: theme.typography.fontFamily.medium,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.label,
              marginBottom: theme.spacing.xs,
            }}
          >
            Current balance
          </Text>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.display ?? 36,
              lineHeight: theme.typography.lineHeight.display ?? 44,
              fontFamily: theme.typography.fontFamily.bold,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatBalanceDisplay(balance, privacyMode)}
          </Text>
        </View>

        {/* ── Account details ── */}
        <SectionLabel label="Account details" theme={theme} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.medium,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
              paddingHorizontal: 14,
              marginBottom: theme.spacing.lg,
            },
          ]}
        >
          <DetailRow label="Type" value={account.type ?? '—'} theme={theme} />
          <DetailRow label="Category" value={categoryLabel} theme={theme} />
          <DetailRow
            label="Added"
            value={addedDate}
            theme={theme}
          />
        </View>

        {/* ── Recent transactions ── */}
        <SectionLabel label="Recent transactions" theme={theme} />

        {txLoading ? (
          <View
            style={[
              styles.card,
              styles.emptyTx,
              {
                backgroundColor: theme.colors.bgCard,
                borderRadius: theme.radius.medium,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.bodySmall,
                fontFamily: theme.typography.fontFamily.regular,
                textAlign: 'center',
              }}
            >
              Loading transactions...
            </Text>
          </View>
        ) : recentTx.length === 0 ? (
          <View
            style={[
              styles.card,
              styles.emptyTx,
              {
                backgroundColor: theme.colors.bgCard,
                borderRadius: theme.radius.medium,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.bodySmall,
                fontFamily: theme.typography.fontFamily.regular,
                textAlign: 'center',
              }}
            >
              No transactions yet.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.bgCard,
                  borderRadius: theme.radius.medium,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: theme.colors.border,
                  paddingHorizontal: 14,
                  marginBottom: theme.spacing.sm,
                },
              ]}
            >
              {recentTx.map((tx, index) => (
                <TransactionItem
                  key={tx.id}
                  item={tx}
                  isLast={index === recentTx.length - 1}
                  theme={theme}
                />
              ))}
            </View>

            <TouchableOpacity
                onPress={() => {}}   // TODO: wire this to TransactionHistoryScreen in Module 2.3.8
                style={styles.viewAllBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="View all transactions"
              >
              <Text
                style={{
                  color: theme.colors.accentMain,
                  fontSize: theme.typography.fontSize.bodySmall,
                  fontFamily: theme.typography.fontFamily.medium,
                }}
              >
                View All →
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  card: {},
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTx: {
    paddingVertical: 24,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  viewAllBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});