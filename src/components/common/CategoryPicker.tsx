// src/components/common/CategoryPicker.tsx

import { asc, eq } from 'drizzle-orm';
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import db from '@/db';
import { categories, type Category } from '@/db/schema';
import { useTheme, type Theme } from '@/theme';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — theme-independent, safe outside the component
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLUMNS = 4;
const ICON_SIZE = 48;
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.75;

// autoIncrement PKs are always >= 1, so -1 is collision-free as a sentinel
const CUSTOM_SENTINEL_ID = -1 as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type PickerType = 'income' | 'expense' | 'all';
type ActiveTab  = 'income' | 'expense';

export interface CategoryPickerProps {
  visible: boolean;
  type: PickerType;
  selectedCategoryId: number | null;
  onSelect: (category: Category) => void;
  onClose: () => void;
}

interface SentinelItem {
  id: typeof CUSTOM_SENTINEL_ID;
  _isSentinel: true;
}

type GridItem = Category | SentinelItem;

// ─────────────────────────────────────────────────────────────────────────────
// TYPE GUARD
// ─────────────────────────────────────────────────────────────────────────────

function isSentinel(item: GridItem): item is SentinelItem {
  return (item as SentinelItem)._isSentinel === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES FACTORY
//
// Receives theme + the two layout values that derive from it so the
// StyleSheet is fully self-contained and recomputes only when theme changes.
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(
  theme: Theme,
  gridHPadding: number,
  cellOuterSize: number,
) {
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

    // ── Type tabs (only when type === 'all') ───────────────────────────────
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
      gap: theme.spacing.sm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.medium,
      backgroundColor: theme.colors.bgPage,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabActive: {
      backgroundColor: theme.colors.accentSubtle,
      borderColor: theme.colors.accentMain,
    },
    tabLabel: {
      fontSize: theme.typography.fontSize.body,
      lineHeight: theme.typography.lineHeight.body,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
    },
    tabLabelActive: {
      color: theme.colors.accentMain,
      fontFamily: theme.typography.fontFamily.semibold,
    },

    // ── Search ─────────────────────────────────────────────────────────────
    searchRow: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
    },
    searchInput: {
      backgroundColor: theme.colors.bgInput,
      borderRadius: theme.radius.medium,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      height: 40,
      fontSize: theme.typography.fontSize.body,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textPrimary,
    },

    // ── Grid ───────────────────────────────────────────────────────────────
    grid: {
      paddingHorizontal: gridHPadding,
      paddingBottom: theme.spacing.xl,
    },

    // ── Cell outer ─────────────────────────────────────────────────────────
    // Carries opacity so the cell always holds its grid slot.
    // Faded cells are visible but non-interactive (see disabled prop).
    cell: {
      width: cellOuterSize,
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
    },
    // Inner touchable applies selection border + background
    cellInner: {
      alignItems: 'center',
      width: '100%',
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.medium,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    cellInnerSelected: {
      borderColor: theme.colors.accentMain,
      backgroundColor: theme.colors.accentSubtle,
    },

    // ── Icon box ───────────────────────────────────────────────────────────
    iconBox: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      borderRadius: theme.radius.medium,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.xs,
    },
    iconExpense: {
      // warningSubtle — expense category background
      backgroundColor: theme.colors.warningSubtle,
    },
    iconIncome: {
      // successSubtle — income category background
      backgroundColor: theme.colors.successSubtle,
    },
    iconSelected: {
      backgroundColor: theme.colors.accentMain,
    },
    iconDisabled: {
      // Used for the sentinel "+ Custom" cell
      backgroundColor: theme.colors.border,
    },

    iconInitial: {
      fontSize: theme.typography.fontSize.bodyLarge,
      fontFamily: theme.typography.fontFamily.semibold,
      color: theme.colors.textSecondary,
    },
    iconInitialSelected: {
      color: theme.colors.textInverse,
    },

    // ── Cell label ─────────────────────────────────────────────────────────
    cellLabel: {
      fontSize: theme.typography.fontSize.label,
      lineHeight: theme.typography.lineHeight.label,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    cellLabelSelected: {
      color: theme.colors.accentMain,
      fontFamily: theme.typography.fontFamily.semibold,
    },
    cellLabelDisabled: {
      color: theme.colors.textDisabled,
    },

    // ── Sentinel "+ Custom" label ──────────────────────────────────────────
    customPlus: {
      fontSize: theme.typography.fontSize.heading1,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textDisabled,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CategoryPicker({
  visible,
  type,
  selectedCategoryId,
  onSelect,
  onClose,
}: CategoryPickerProps) {
  const theme = useTheme();

  // These two layout values derive from theme.spacing, so they live
  // inside the component and update with theme changes.
  const gridHPadding  = theme.spacing.base;
  const cellOuterSize = useMemo(
    () => Math.floor((SCREEN_WIDTH - gridHPadding * 2) / COLUMNS),
    [gridHPadding],
  );

  const styles = useMemo(
    () => makeStyles(theme, gridHPadding, cellOuterSize),
    [theme, gridHPadding, cellOuterSize],
  );

  // ── State ──────────────────────────────────────────────────────────────────
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [activeTab,     setActiveTab]     = useState<ActiveTab>('expense');
  // modalVisible lags behind `visible` so slide-down can complete
  // before React unmounts the Modal.
  const [modalVisible,  setModalVisible]  = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;
  // DB query runs once per component lifetime — hasLoaded guards it.
  const hasLoaded = useRef(false);

  // ── DB load ────────────────────────────────────────────────────────────────
  const loadCategories = useCallback(async () => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    try {
      const rows = await db
        .select()
        .from(categories)
        .where(eq(categories.is_active, 1))
        .orderBy(asc(categories.display_order), asc(categories.name));
      setAllCategories(rows);
    } catch {
      // Non-fatal: grid renders empty until categories are seeded.
      // The error surfaces in dev via React Native's red box if needed.
    }
  }, []);

  // ── Open / close animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setModalVisible(true);
      loadCategories();
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
    // slideAnim is a stable ref; loadCategories is memoized — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, loadCategories, slideAnim]);

  // ── Derived grid data ──────────────────────────────────────────────────────
  const effectiveType: ActiveTab = type === 'all' ? activeTab : type;

  const typeFiltered = allCategories.filter((c) => c.type === effectiveType);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Sentinel always appended last so it survives search filtering
  const gridData: GridItem[] = [
    ...typeFiltered,
    { id: CUSTOM_SENTINEL_ID, _isSentinel: true },
  ];

  // ── Cell renderer ──────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: GridItem }) => {
    // Sentinel: non-interactive "+ Custom" placeholder
    if (isSentinel(item)) {
      return (
        <View style={styles.cell} accessible={false}>
          <View style={[styles.iconBox, styles.iconDisabled]}>
            <Text style={styles.customPlus}>+</Text>
          </View>
          <Text
            style={[styles.cellLabel, styles.cellLabelDisabled]}
            numberOfLines={2}
          >
            Custom
          </Text>
        </View>
      );
    }

    const category  = item as Category;
    const isSelected = category.id === selectedCategoryId;
    const matches    =
      normalizedQuery === '' ||
      category.name.toLowerCase().includes(normalizedQuery);

    return (
      // Outer View carries opacity — cell keeps its grid slot while faded
      <View style={[styles.cell, { opacity: matches ? 1 : 0.25 }]}>
        <TouchableOpacity
          style={[
            styles.cellInner,
            isSelected && styles.cellInnerSelected,
          ]}
          onPress={() => {
            if (!matches) return;
            onSelect(category);
            onClose();
          }}
          activeOpacity={0.7}
          disabled={!matches}
        >
          <View
            style={[
              styles.iconBox,
              isSelected
                ? styles.iconSelected
                : category.type === 'income'
                  ? styles.iconIncome
                  : styles.iconExpense,
            ]}
          >
            <Text
              style={[
                styles.iconInitial,
                isSelected && styles.iconInitialSelected,
              ]}
            >
              {category.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text
            style={[
              styles.cellLabel,
              isSelected && styles.cellLabelSelected,
            ]}
            numberOfLines={2}
          >
            {category.name}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"       // we drive animation manually
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
            <Text style={styles.headerTitle}>Select Category</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Type tab switcher — only when type === 'all' */}
          {type === 'all' && (
            <View style={styles.tabRow}>
              {(['expense', 'income'] as ActiveTab[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      activeTab === tab && styles.tabLabelActive,
                    ]}
                  >
                    {tab === 'expense' ? 'Expense' : 'Income'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Search */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search categories..."
              placeholderTextColor={theme.colors.textDisabled}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="done"
              clearButtonMode="while-editing"
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {/* Category grid */}
          <FlatList<GridItem>
            data={gridData}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            numColumns={COLUMNS}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </Animated.View>
      </View>
    </Modal>
  );
}