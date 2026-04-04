// src/components/common/ObligationPicker.tsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

import { formatCurrency } from '@/utils/formatCurrency';
import useObligationStore from '@/store/useObligationStore';
import { useTheme, type Theme } from '@/theme';
import type { Obligation } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ICON_SIZE    = 40;
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.65;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ObligationPickerProps {
  visible: boolean;
  selectedId: number | null;
  onSelect: (obligation: Obligation | null) => void;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  credit_card: 'Credit Card',
  personal_loan: 'Personal Loan',
  bank_loan: 'Bank Loan',
  bnpl: 'BNPL',
  installment: 'Installment',
  other: 'Other',
};

function iconBgForType(type: string, colors: Theme['colors']): string {
  switch (type) {
    case 'credit_card':
      return colors.dangerSubtle;
    case 'personal_loan':
    case 'bank_loan':
      return colors.warningSubtle;
    case 'bnpl':
    case 'installment':
      return colors.accentSubtle;
    default:
      return colors.border;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
    },
    sheet: {
      backgroundColor: theme.colors.bgCard,
      borderTopLeftRadius: theme.radius.large,
      borderTopRightRadius: theme.radius.large,
      maxHeight: SHEET_MAX_HEIGHT,
      ...theme.shadows.modal,
    },
    handleBar: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.border,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
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
    listContent: {
      paddingBottom: theme.spacing.xl,
    },
    // Clear button row
    clearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      paddingRight: theme.spacing.base,
      paddingLeft: theme.spacing.base - 3,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    clearText: {
      flex: 1,
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
    },
    clearSelected: {
      backgroundColor: theme.colors.accentSubtle,
      borderLeftColor: theme.colors.accentMain,
    },
    clearTextSelected: {
      color: theme.colors.accentMain,
      fontFamily: theme.typography.fontFamily.semibold,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginLeft: theme.spacing.base + ICON_SIZE + theme.spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      paddingRight: theme.spacing.base,
      paddingLeft: theme.spacing.base - 3,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    rowSelected: {
      backgroundColor: theme.colors.accentSubtle,
      borderLeftColor: theme.colors.accentMain,
    },
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
    textSection: {
      flex: 1,
    },
    rowName: {
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs / 2,
    },
    rowNameSelected: {
      color: theme.colors.accentMain,
      fontFamily: theme.typography.fontFamily.semibold,
    },
    rowSubtitle: {
      fontSize: theme.typography.fontSize.label,
      lineHeight: theme.typography.lineHeight.label,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
    },
    rowSubtitleSelected: {
      color: theme.colors.accentMain,
    },
    rowBalance: {
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textPrimary,
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

export default function ObligationPicker({
  visible,
  selectedId,
  onSelect,
  onClose,
}: ObligationPickerProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const obligations = useObligationStore((s) => s.obligations);
  const [modalVisible, setModalVisible] = React.useState(false);
  const slideAnim = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;

  // ── Open / close animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setModalVisible(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, slideAnim]);

  // ── Sub-components ─────────────────────────────────────────────────────────
  const ItemSeparator = useCallback(
    () => <View style={styles.separator} />,
    [styles.separator],
  );

  // ── Row renderer ───────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: Obligation }) => {
      const isSelected = item.id === selectedId;
      const iconBg = iconBgForType(item.type, theme.colors);
      const typeLabel = TYPE_LABEL[item.type] ?? item.type;
      const balance = item.current_balance ?? 0;
      const balanceStr = formatCurrency(balance);

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

          <View style={styles.textSection}>
            <Text
              style={[styles.rowName, isSelected && styles.rowNameSelected]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              style={[
                styles.rowSubtitle,
                isSelected && styles.rowSubtitleSelected,
              ]}
            >
              {typeLabel}
            </Text>
          </View>

          <Text
            style={[styles.rowBalance, isSelected && styles.rowBalanceSelected]}
          >
            {balanceStr}
          </Text>
        </TouchableOpacity>
      );
    },
    [
      selectedId,
      theme.colors,
      styles,
      onSelect,
      onClose,
    ],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={styles.backdrop} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.handleBar} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Pay Toward Debt</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* "None" / Clear option at top */}
          <TouchableOpacity
            style={[styles.clearRow, selectedId === null && styles.clearSelected]}
            onPress={() => {
              onSelect(null);
              onClose();
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.clearText,
                selectedId === null && styles.clearTextSelected,
              ]}
            >
              None (Skip)
            </Text>
          </TouchableOpacity>

          {obligations.length > 0 && <View style={styles.separator} />}

          {/* Obligations list */}
          {obligations.length > 0 ? (
            <FlatList<Obligation>
              data={obligations}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              ItemSeparatorComponent={ItemSeparator}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Text style={styles.clearText}>
                No active debts to pay toward
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
