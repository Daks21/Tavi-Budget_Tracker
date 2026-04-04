// src/components/common/AccountPicker.tsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getAllAccountBalances } from '@/utils/calculations';
import { formatBalanceDisplay } from '@/utils/formatCurrency';
import useWalletStore from '@/store/useWalletStore';
import { useTheme, type Theme } from '@/theme';
import type { Account } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — theme-independent, safe outside the component
// ─────────────────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ICON_SIZE    = 40;
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.65;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AccountPickerProps {
  visible: boolean;
  selectedAccountId: number | null;
  excludeAccountId?: number | null;
  onSelect: (account: Account) => void;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — map account type to an icon background color token
// ─────────────────────────────────────────────────────────────────────────────

function iconBgForType(type: string, colors: Theme['colors']): string {
  switch (type) {
    case 'cash':
    case 'bank':
      return colors.successSubtle;
    case 'ewallet':
    case 'virtual_fund':
      return colors.accentSubtle;
    case 'credit_card':
      return colors.warningSubtle;
    default:
      return colors.border;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES FACTORY
//
// Receives the full theme object; recomputes only when theme changes.
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    // ── Modal root ─────────────────────────────────────────────────────────
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
    },

    // ── Sheet ──────────────────────────────────────────────────────────────
    sheet: {
      backgroundColor: theme.colors.bgCard,
      borderTopLeftRadius: theme.radius.large,
      borderTopRightRadius: theme.radius.large,
      maxHeight: SHEET_MAX_HEIGHT,
      ...theme.shadows.modal,
    },

    // ── Drag handle ────────────────────────────────────────────────────────
    handleBar: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.border,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },

    // ── Header ─────────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: theme.typography.fontSize.heading2,
      lineHeight: theme.typography.lineHeight.heading2,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textPrimary,
    },
    closeButton: {
      padding: theme.spacing.xs,
    },
    closeX: {
      fontSize: theme.typography.fontSize.heading2,
      lineHeight: theme.typography.lineHeight.heading2,
      color: theme.colors.textSecondary,
    },

    // ── List ───────────────────────────────────────────────────────────────
    listContent: {
      paddingBottom: theme.spacing.xl,
    },

    // ── Row ────────────────────────────────────────────────────────────────
    // borderLeftWidth always present so layout is stable; color swaps on selection.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      paddingRight: theme.spacing.base,
      // left padding absorbs the 3px border so text doesn't shift on select
      paddingLeft: theme.spacing.base - 3,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    rowSelected: {
      backgroundColor: theme.colors.accentSubtle,
      borderLeftColor: theme.colors.accentMain,
    },

    // ── Separator ──────────────────────────────────────────────────────────
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      // indent so it starts after the icon
      marginLeft: theme.spacing.base + ICON_SIZE + theme.spacing.md,
    },

    // ── Icon placeholder ───────────────────────────────────────────────────
    iconBox: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      borderRadius: theme.radius.medium,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
      flexShrink: 0,
    },
    iconInitial: {
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textSecondary,
    },

    // ── Row text ───────────────────────────────────────────────────────────
    rowName: {
      flex: 1,
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textPrimary,
    },
    rowNameSelected: {
      color: theme.colors.accentMain,
      fontFamily: theme.typography.fontFamily.semibold,
    },
    rowBalance: {
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing.sm,
      flexShrink: 0,
    },
    rowBalanceSelected: {
      color: theme.colors.accentMain,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AccountPicker({
  visible,
  selectedAccountId,
  excludeAccountId,
  onSelect,
  onClose,
}: AccountPickerProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { accounts, privacyMode } = useWalletStore();

  // balances loaded asynchronously when the sheet opens
  const [balances, setBalances] = useState<Map<number, number>>(new Map());

  // modalVisible lags behind `visible` so slide-down can complete
  // before React unmounts the Modal.
  const [modalVisible, setModalVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;

  // ── Derived list data ──────────────────────────────────────────────────────
  const visibleAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.is_active === 1 && a.id !== (excludeAccountId ?? undefined),
      ),
    [accounts, excludeAccountId],
  );

  // ── Balance loader ─────────────────────────────────────────────────────────
  const loadBalances = useCallback(async () => {
    if (visibleAccounts.length === 0) return;
    try {
      const ids = visibleAccounts.map((a) => a.id);
      const result = await getAllAccountBalances(ids);
      setBalances(result);
    } catch {
      // Non-fatal: rows show ₱0.00 until computed.
    }
  }, [visibleAccounts]);

  // ── Open / close animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      loadBalances();
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 22,
        stiffness: 220,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SHEET_MAX_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setModalVisible(false));
    }
    // slideAnim is a stable ref; loadBalances is memoized — safe to include
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, loadBalances, slideAnim]);

  // ── Sub-components ─────────────────────────────────────────────────────────
  const ItemSeparator = useCallback(
    () => <View style={styles.separator} />,
    [styles.separator],
  );

  // ── Row renderer ───────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: Account }) => {
      const isSelected = item.id === selectedAccountId;
      const balance    = balances.get(item.id);
      const iconBg     = iconBgForType(item.type, theme.colors);

      return (
        <TouchableOpacity
          style={[styles.row, isSelected && styles.rowSelected]}
          onPress={() => {
            onSelect(item);
            onClose();
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
            <Text style={styles.iconInitial}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text
            style={[styles.rowName, isSelected && styles.rowNameSelected]}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          <Text
            style={[styles.rowBalance, isSelected && styles.rowBalanceSelected]}
          >
            {balance == null ? '—' : formatBalanceDisplay(balance, privacyMode)}
          </Text>
        </TouchableOpacity>
      );
    },
    [
      selectedAccountId,
      balances,
      theme.colors,
      styles,
      privacyMode,
      onSelect,
      onClose,
    ],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"       // animation is driven manually
      statusBarTranslucent       // sheet slides over status bar correctly
      onRequestClose={onClose}   // Android hardware back button
    >
      <View style={styles.root}>
        {/* Backdrop: full-screen pressable behind the sheet */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={styles.backdrop} />
        </Pressable>

        {/* Animated sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Wallet</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Account list */}
          <FlatList<Account>
            data={visibleAccounts}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={ItemSeparator}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </Animated.View>
      </View>
    </Modal>
  );
}
