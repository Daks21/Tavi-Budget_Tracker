import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { OnboardingStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useOnboardingStore from '@/store/useOnboardingStore';
import WalletPickerForm, {
  type WalletFormData,
} from '@/components/onboarding/WalletPickerForm';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AddMoreWallets'>;

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, filled, theme }: { total: number; filled: number; theme: Theme }) {
  return (
    <View style={dotStyles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            { backgroundColor: i < filled ? theme.colors.accentMain : theme.colors.border },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  dot: { width: 8, height: 8, borderRadius: 9999 },
});

// ─── Added wallet chip ────────────────────────────────────────────────────────

function AddedWalletChip({
  name,
  balance,
  onRemove,
  theme,
}: {
  name: string;
  balance: number;
  onRemove: () => void;
  theme: Theme;
}) {
  const formatted = balance.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <View
      style={[
        chipStyles.root,
        {
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.full,
        },
      ]}
    >
      <View style={chipStyles.textGroup}>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.bodySmall,
            fontFamily: theme.typography.fontFamily.medium,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={{
            color: theme.colors.accentMain,
            fontSize: theme.typography.fontSize.caption,
            fontFamily: theme.typography.fontFamily.regular,
            marginTop: 1,
          }}
        >
          ₱{formatted}
        </Text>
      </View>

      {/* Fix 5: use theme tokens instead of hardcoded 11/14 */}
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${name}`}
        style={[chipStyles.removeBtn, { backgroundColor: theme.colors.border }]}
      >
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.caption,
            lineHeight: theme.typography.lineHeight.caption,
            fontFamily: theme.typography.fontFamily.semibold,
          }}
        >
          ✕
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  textGroup: { flexDirection: 'column', marginRight: 8 },
  removeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

function WalletBottomSheet({
  visible,
  excludeKeys,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  excludeKeys: string[];
  onSubmit: (data: WalletFormData) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  React.useEffect(() => {
    if (visible) {
      isAnimating.current = true;
      Animated.spring(slideAnim, {
        toValue: 1,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start(() => { isAnimating.current = false; });
    }
  }, [visible, slideAnim]);

  const handleClose = useCallback(() => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      isAnimating.current = false;
      slideAnim.setValue(0);
      onClose();
    });
  }, [onClose, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [700, 0],
  });

  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[sheetStyles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <KeyboardAvoidingView
        style={sheetStyles.sheetOuter}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            sheetStyles.sheet,
            {
              backgroundColor: theme.colors.bgPage,
              borderTopLeftRadius: theme.radius.large,
              borderTopRightRadius: theme.radius.large,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={sheetStyles.handleRow}>
            <View style={[sheetStyles.handle, { backgroundColor: theme.colors.border }]} />
          </View>

          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.bodyLarge,
              fontFamily: theme.typography.fontFamily.semibold,
              paddingHorizontal: theme.spacing.base,
              marginBottom: theme.spacing.lg,
            }}
          >
            Add another wallet
          </Text>

          <ScrollView
            style={sheetStyles.scrollArea}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.base,
              paddingBottom: 24,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Fix 4: cancelLabel = "Cancel" in the sheet context */}
            <WalletPickerForm
              excludeKeys={excludeKeys}
              submitLabel="Add Wallet"
              cancelLabel="Cancel"
              onSubmit={onSubmit}
              onCancel={handleClose}
            />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  sheetOuter: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%' },
  handleRow: { alignItems: 'center', paddingVertical: 12 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  scrollArea: { flexGrow: 0 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AddMoreWalletsScreen({ navigation }: Props) {
  const theme = useTheme();

  const walletsAdded = useOnboardingStore((state) => state.walletsAdded);
  const addWallet = useOnboardingStore((state) => state.addWallet);
  const removeWallet = useOnboardingStore((state) => state.removeWallet);

  const [sheetOpen, setSheetOpen] = useState(false);

  const excludeKeys = walletsAdded.map((w) => w.walletKey);
  const hasMultiple = walletsAdded.length >= 2;

  const handleFormSubmit = useCallback(
    (data: WalletFormData) => {
      addWallet(data);
      setSheetOpen(false);
    },
    [addWallet],
  );

  return (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView
          style={[styles.root, { backgroundColor: theme.colors.bgPage }]}
          edges={['top', 'bottom']}
        >
          <StatusBar style="auto" />
          <ProgressDots total={5} filled={4} theme={theme} />

          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: theme.spacing.base },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: theme.typography.fontSize.heading1,
                lineHeight: theme.typography.lineHeight.heading1,
                fontFamily: theme.typography.fontFamily.semibold,
                marginBottom: theme.spacing.sm,
              }}
            >
              Any other wallets?
            </Text>

            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.body,
                lineHeight: theme.typography.lineHeight.body,
                fontFamily: theme.typography.fontFamily.regular,
                marginBottom: theme.spacing.xl,
              }}
            >
              Most people have 2 or 3. Add them now for a complete picture — or
              skip and add them later.
            </Text>

            {/* ── Added so far ── */}
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
              Added so far:
            </Text>

            {walletsAdded.length === 0 ? (
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.fontSize.bodySmall,
                  fontFamily: theme.typography.fontFamily.regular,
                  marginBottom: theme.spacing.lg,
                  fontStyle: 'italic',
                }}
              >
                No wallets added yet.
              </Text>
            ) : (
              <View style={styles.chipWrap}>
                {walletsAdded.map((wallet) => (
                  <AddedWalletChip
                    key={wallet.walletKey}
                    name={wallet.name}
                    balance={wallet.openingBalance}
                    onRemove={() => removeWallet(wallet.walletKey)}
                    theme={theme}
                  />
                ))}
              </View>
            )}

            {/* Fix 5: encouragement tint without hex-length dependency */}
            {hasMultiple && (
              <View
                style={[
                  styles.encouragementBanner,
                  {
                    backgroundColor: theme.colors.bgCard,
                    borderColor: theme.colors.accentMain,
                    borderRadius: theme.radius.small,
                    paddingHorizontal: theme.spacing.base,
                    paddingVertical: theme.spacing.sm,
                    marginBottom: theme.spacing.lg,
                  },
                ]}
              >
                <Text
                  style={{
                    color: theme.colors.accentMain,
                    fontSize: theme.typography.fontSize.bodySmall,
                    fontFamily: theme.typography.fontFamily.medium,
                    lineHeight: theme.typography.lineHeight.bodySmall,
                  }}
                >
                  Nice — you've added {walletsAdded.length} wallets. Your full
                  picture is taking shape.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.addAnotherBtn,
                {
                  borderColor: theme.colors.accentMain,
                  borderRadius: theme.radius.medium,
                },
              ]}
              onPress={() => setSheetOpen(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add Another Wallet"
            >
              <Text
                style={{
                  color: theme.colors.accentMain,
                  fontSize: theme.typography.fontSize.body,
                  fontFamily: theme.typography.fontFamily.semibold,
                }}
              >
                + Add Another Wallet
              </Text>
            </TouchableOpacity>

            <View style={{ height: 120 }} />
          </ScrollView>

          <View
            style={[
              styles.bottomArea,
              {
                paddingHorizontal: theme.spacing.base,
                paddingBottom: theme.spacing.base,
                borderTopColor: theme.colors.border,
                backgroundColor: theme.colors.bgPage,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.continueBtn,
                {
                  backgroundColor: theme.colors.accentMain,
                  borderRadius: theme.radius.medium,
                },
              ]}
              onPress={() => navigation.navigate('FirstDashboard')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text
                style={{
                  color: theme.colors.textInverse,
                  fontSize: theme.typography.fontSize.bodyLarge,
                  fontFamily: theme.typography.fontFamily.semibold,
                }}
              >
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <WalletBottomSheet
        visible={sheetOpen}
        excludeKeys={excludeKeys}
        onSubmit={handleFormSubmit}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  encouragementBanner: { borderWidth: 1, marginTop: 4 },
  addAnotherBtn: {
    height: 52,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  bottomArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    alignItems: 'center',
  },
  continueBtn: {
    width: '100%',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
});