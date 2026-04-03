import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { max } from 'drizzle-orm';

import WalletForm, { type WalletFormData } from '@/components/common/WalletForm';
import useWalletStore from '@/store/useWalletStore';
import { useTheme } from '@/theme';
import db from '@/db';
import { accounts } from '@/db/schema';
import type { WalletStackParamList } from '@/types/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation prop type
// ─────────────────────────────────────────────────────────────────────────────
type Props = NativeStackScreenProps<WalletStackParamList, 'AddWallet'>;

// ─────────────────────────────────────────────────────────────────────────────
// Toast timing
// ─────────────────────────────────────────────────────────────────────────────
const TOAST_VISIBLE_MS = 2000;
const TOAST_FADE_MS    = 300;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT — AddWalletScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function AddWalletScreen({ navigation }: Props) {
  const theme  = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toastOpacity     = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

    Animated.timing(toastOpacity, {
      toValue:         1,
      duration:        TOAST_FADE_MS,
      useNativeDriver: true,
    }).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue:         0,
        duration:        TOAST_FADE_MS,
        useNativeDriver: true,
      }).start();
    }, TOAST_VISIBLE_MS);
  }, [toastOpacity]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (data: WalletFormData) => {
      if (isSubmitting) return;
      setIsSubmitting(true);

      try {
        // Step 1 — next display_order
        const orderResult = await db
          .select({ maxOrder: max(accounts.display_order) })
          .from(accounts);

        const nextOrder = (orderResult[0]?.maxOrder ?? -1) + 1;

        // Step 2 — insert account row
        const now = new Date().toISOString();

        await db.insert(accounts).values({
          name:             data.name,
          type:             data.type,
          category:         data.category,
          wallet_key:       data.walletKey,
          starting_balance: data.openingBalance,
          currency:         'PHP',
          icon_key:         data.iconKey,
          display_order:    nextOrder,
          is_active:        1,
          created_at:       now,
          updated_at:       now,
        });

        // Step 3 — refresh store
        await useWalletStore.getState().reloadAccounts();

        // Step 4 — toast then navigate back
        showToast();

        setTimeout(() => {
          navigation.goBack();
        }, TOAST_VISIBLE_MS + TOAST_FADE_MS);
      } catch (err) {
        console.error('[AddWalletScreen] Failed to save wallet:', err);
        setIsSubmitting(false);
      }
    },
    [isSubmitting, navigation, showToast]
  );

  return (
    <View style={styles.root}>
      <WalletForm
        onSubmit={handleSubmit}
        submitLabel="Save Wallet"
        showCategoryPicker
        isSubmitting={isSubmitting}
      />

      {/* Toast — pointerEvents none so it never blocks taps */}
      <Animated.View
        style={[styles.toast, { opacity: toastOpacity }]}
        pointerEvents="none"
      >
        <Text style={styles.toastText}>Wallet saved.</Text>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
type Theme = ReturnType<typeof useTheme>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex:            1,
      backgroundColor: theme.colors.bgPage,
    },
    toast: {
      position:          'absolute',
      bottom:            theme.spacing.xxl,
      alignSelf:         'center',
      backgroundColor:   theme.colors.textPrimary,
      paddingVertical:   theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius:      theme.radius.full,
    },
    toastText: {
      fontSize:   theme.typography.fontSize.bodySmall,
      lineHeight: theme.typography.lineHeight.bodySmall,
      fontFamily: theme.typography.fontFamily.medium,
      color:      theme.colors.textInverse,
    },
  });
}