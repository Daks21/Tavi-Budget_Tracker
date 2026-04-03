// src/screens/wallets/EditWalletScreens.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { count, eq } from 'drizzle-orm';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { WalletStackParamList } from '@/types/navigation';
import { useTheme } from '@/theme';
import useWalletStore from '@/store/useWalletStore';
import WalletForm, {
  type WalletFormData,
  type WalletFormInitialValues,
} from '@/components/common/WalletForm';
import db from '@/db';
import { accounts, transactions } from '@/db/schema';

type Props = NativeStackScreenProps<WalletStackParamList, 'EditWallet'>;

export default function EditWalletScreen({ route, navigation }: Props) {
  const { accountId } = route.params;
  const theme = useTheme();

  const account = useWalletStore((s) => s.getAccountById(accountId));
  const reloadAccounts = useWalletStore((s) => s.reloadAccounts);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [txCount, setTxCount] = useState<number>(0);

  // ── Load linked transaction count from DB ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadTxCount() {
      try {
        const result = await db
          .select({ value: count() })
          .from(transactions)
          .where(eq(transactions.account_id, accountId));

        if (!cancelled) {
          setTxCount(result[0]?.value ?? 0);
        }
      } catch (error) {
        console.error('[EditWallet] failed to count transactions:', error);
      }
    }

    loadTxCount();
    return () => { cancelled = true; };
  }, [accountId]);

  // ── Map account → WalletForm initialValues ──────────────────────────────────
  const initialValues = useMemo<WalletFormInitialValues | undefined>(() => {
    if (!account) return undefined;

    return {
      walletKey: account.wallet_key ?? 'other',
      name: account.name,
      category:
        (account.category as WalletFormInitialValues['category']) ?? 'personal',
      openingBalance: account.starting_balance ?? 0,
    };
  }, [account]);

  // ── Header ──────────────────────────────────────────────────────────────────
  React.useLayoutEffect(() => {
    navigation.setOptions({ title: account?.name ?? 'Edit Wallet' });
  }, [navigation, account?.name]);

  // ── Save handler ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (data: WalletFormData) => {
      if (saving) return;
      setSaving(true);

      try {
        const now = new Date().toISOString();

        await db
          .update(accounts)
          .set({
            name: data.name,
            type: data.type,
            category: data.category,
            wallet_key: data.walletKey,
            starting_balance: data.openingBalance,
            icon_key: data.iconKey,
            updated_at: now,
          })
          .where(eq(accounts.id, accountId));

        await reloadAccounts();
        navigation.goBack();
      } catch (error) {
        console.error('[EditWallet] update failed:', error);
        Alert.alert('Something went wrong', 'Please try again.', [
          { text: 'OK' },
        ]);
      } finally {
        setSaving(false);
      }
    },
    [accountId, navigation, reloadAccounts, saving],
  );

  // ── Delete handler ───────────────────────────────────────────────────────────
  const handleDeletePress = useCallback(() => {
    const hasTransactions = txCount > 0;

    const message = hasTransactions
      ? `This wallet has ${txCount} transaction${txCount === 1 ? '' : 's'}. They will remain in your history but the wallet will no longer appear in your balance.`
      : 'This wallet will be hidden from your balance. Your data is kept.';

    Alert.alert('Remove wallet?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: confirmDelete },
    ]);
  }, [txCount]);

  const confirmDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);

    try {
      const now = new Date().toISOString();

      // Soft delete — never hard delete
      await db
        .update(accounts)
        .set({ is_active: 0, updated_at: now })
        .where(eq(accounts.id, accountId));

      await reloadAccounts();
      navigation.navigate('WalletList');
    } catch (error) {
      console.error('[EditWallet] soft delete failed:', error);
      Alert.alert('Something went wrong', 'Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setDeleting(false);
    }
  }, [accountId, deleting, navigation, reloadAccounts]);

  // ── Guard ────────────────────────────────────────────────────────────────────
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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <WalletForm
            initialValues={initialValues}
            showCategoryPicker
            submitLabel={saving ? 'Saving…' : 'Save Changes'}
            cancelLabel="Cancel"
            onSubmit={handleSubmit}
            onCancel={() => navigation.goBack()}
          />

          {/* ── Danger zone ── */}
          <View
            style={[
              styles.dangerSection,
              {
                borderTopColor: theme.colors.border,
                marginTop: theme.spacing.xl,
                paddingTop: theme.spacing.lg,
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleDeletePress}
              disabled={deleting}
              activeOpacity={0.7}
              style={styles.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel="Remove wallet"
            >
              <Text
                style={{
                  color: deleting
                    ? theme.colors.textSecondary
                    : theme.colors.dangerMain,
                  fontSize: theme.typography.fontSize.body,
                  fontFamily: theme.typography.fontFamily.medium,
                  textAlign: 'center',
                }}
              >
                {deleting ? 'Removing…' : 'Remove Wallet'}
              </Text>
            </TouchableOpacity>

            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.caption,
                fontFamily: theme.typography.fontFamily.regular,
                textAlign: 'center',
                marginTop: theme.spacing.xs,
                paddingHorizontal: theme.spacing.base,
              }}
            >
              Removing a wallet hides it from your balance. Your transaction
              history is always kept.
            </Text>
          </View>

          <View style={{ height: 48 }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingTop: 16 },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  dangerSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deleteBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});