// src/onboarding/FirstDashboardScreen.tsx

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { OnboardingStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useOnboardingStore from '@/store/useOnboardingStore';
import { formatCurrency } from '@/utils/formatCurrency';
import { useOnboardingComplete } from '@/context/OnboardingCompleteContext';
import db, { initializeDatabase } from '@/db';
import { seedDatabase } from '@/db/seed';
import { accounts, userProfile } from '@/db/schema';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FirstDashboard'>;

// ─── Mascot placeholder ───────────────────────────────────────────────────────

function MascotPlaceholder({ theme }: { theme: Theme }) {
  return (
    <View
      style={[
        mascotStyles.root,
        { backgroundColor: theme.colors.accentSubtle },
      ]}
    >
      <View
        style={[mascotStyles.face, { backgroundColor: theme.colors.accentMain }]}
      >
        <View style={mascotStyles.eyes}>
          <View
            style={[mascotStyles.eye, { backgroundColor: theme.colors.textInverse }]}
          />
          <View
            style={[mascotStyles.eye, { backgroundColor: theme.colors.textInverse }]}
          />
        </View>
        <View
          style={[
            mascotStyles.smile,
            { borderBottomColor: theme.colors.textInverse },
          ]}
        />
      </View>
    </View>
  );
}

const mascotStyles = StyleSheet.create({
  root: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  face: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  eyes: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  eye: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  smile: {
    width: 28,
    height: 14,
    borderBottomWidth: 3,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
});

// ─── Wallet card ──────────────────────────────────────────────────────────────

type WalletCardItem = {
  walletKey: string;
  name: string;
  openingBalance: number;
  iconKey: string;
};

function WalletCard({
  item,
  theme,
  isLast,
}: {
  item: WalletCardItem;
  theme: Theme;
  isLast: boolean;
}) {
  return (
    <View
      style={[
        cardStyles.root,
        {
          backgroundColor: theme.colors.bgCard,
          borderRadius: theme.radius.medium,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          marginBottom: isLast ? 0 : theme.spacing.sm,
        },
      ]}
    >
      <View
        style={[
          cardStyles.iconBox,
          {
            backgroundColor: theme.colors.accentSubtle,
            borderRadius: theme.radius.small,
          },
        ]}
      >
        <Text style={cardStyles.iconEmoji}>💳</Text>
      </View>

      <View style={cardStyles.textGroup}>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.body,
            fontFamily: theme.typography.fontFamily.semibold,
            lineHeight: theme.typography.lineHeight.body,
          }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.bodySmall,
            fontFamily: theme.typography.fontFamily.regular,
            lineHeight: theme.typography.lineHeight.bodySmall,
            marginTop: 2,
          }}
        >
          {formatCurrency(item.openingBalance)}
        </Text>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  textGroup: {
    flex: 1,
  },
});

// ─── Copy helpers ─────────────────────────────────────────────────────────────

function resolveGreeting(wallets: WalletCardItem[]): string {
  if (wallets.length === 0) return "You're all set.";
  if (wallets.length === 1) return `Here's your ${wallets[0].name}.`;
  return "Here's your full picture.";
}

function resolveSubtext(walletCount: number): string {
  if (walletCount === 0) {
    return 'Add your first wallet anytime from the Wallets tab.';
  }
  return "This is everything Tavi knows about your money right now. The more you add, the clearer your picture gets.";
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FirstDashboardScreen(_props: Props) {
  const theme = useTheme();
  const { completeOnboarding } = useOnboardingComplete();

  const walletsAdded = useOnboardingStore((state) => state.walletsAdded);
  const incomeType = useOnboardingStore((state) => state.incomeType);
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);

  const [loading, setLoading] = useState(false);

  const totalBalance = useMemo(
    () => walletsAdded.reduce((sum, w) => sum + w.openingBalance, 0),
    [walletsAdded],
  );

  const greeting = resolveGreeting(walletsAdded);
  const subtext = resolveSubtext(walletsAdded.length);

  const handleGoToTavi = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // 1. Ensure DB is ready
      await initializeDatabase();

      const now = new Date().toISOString();

      // 2. Insert USER_PROFILE
      await db.insert(userProfile).values({
        income_type: incomeType ?? 'irregular',
        onboarding_done: 1,
        preferred_currency: 'PHP',
        preferred_locale: 'en-PH',
        created_at: now,
        updated_at: now,
      });

      // 3. Insert each wallet as an ACCOUNTS row
      for (let i = 0; i < walletsAdded.length; i++) {
        const wallet = walletsAdded[i];
        await db.insert(accounts).values({
          name: wallet.name,
          type: wallet.type,
          category: 'personal',
          wallet_key: wallet.walletKey,
          starting_balance: wallet.openingBalance,
          currency: 'PHP',
          icon_key: wallet.iconKey,
          display_order: i,
          is_active: 1,
          created_at: now,
          updated_at: now,
        });
      }

      // 4. Seed reference data
      await seedDatabase(db);

      // 5. Clear onboarding store
      resetOnboarding();

      // 6. Signal root navigator — provided by OnboardingCompleteProvider (Step 2.1.8)
      completeOnboarding();
    } catch (error) {
      console.error('[FirstDashboard] onboarding commit failed:', error);
      Alert.alert('Something went wrong', 'Please try again.', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.bgPage }]}
        edges={['top', 'bottom']}
      >
        <StatusBar style="auto" />

        <FlatList
          data={walletsAdded}
          keyExtractor={(item) => item.walletKey}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: theme.spacing.base },
          ]}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <MascotPlaceholder theme={theme} />

              <Text
                style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.typography.fontSize.heading1,
                  lineHeight: theme.typography.lineHeight.heading1,
                  fontFamily: theme.typography.fontFamily.semibold,
                  textAlign: 'center',
                  marginBottom: theme.spacing.sm,
                }}
              >
                {greeting}
              </Text>

              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.fontSize.body,
                  lineHeight: theme.typography.lineHeight.body,
                  fontFamily: theme.typography.fontFamily.regular,
                  textAlign: 'center',
                  marginBottom: theme.spacing.xl,
                  paddingHorizontal: theme.spacing.sm,
                }}
              >
                {subtext}
              </Text>

              {walletsAdded.length > 0 && (
                <View
                  style={[
                    styles.totalCard,
                    {
                      backgroundColor: theme.colors.bgCard,
                      borderRadius: theme.radius.medium,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: theme.colors.border,
                      marginBottom: theme.spacing.lg,
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
                    Total
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.fontSize.display ?? 40,
                      lineHeight: theme.typography.lineHeight.display ?? 48,
                      fontFamily: theme.typography.fontFamily.bold,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {formatCurrency(totalBalance)}
                  </Text>
                </View>
              )}

              {walletsAdded.length > 0 && (
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
                  Your wallets
                </Text>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <WalletCard
              item={item}
              theme={theme}
              isLast={index === walletsAdded.length - 1}
            />
          )}
          ListFooterComponent={<View style={{ height: 120 }} />}
        />

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
              styles.primaryBtn,
              {
                backgroundColor: loading
                  ? theme.colors.border
                  : theme.colors.accentMain,
                borderRadius: theme.radius.medium,
              },
            ]}
            onPress={handleGoToTavi}
            disabled={loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go to Tavi"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.textInverse} size="small" />
            ) : (
              <Text
                style={{
                  color: theme.colors.textInverse,
                  fontSize: theme.typography.fontSize.bodyLarge,
                  lineHeight: theme.typography.lineHeight.bodyLarge,
                  fontFamily: theme.typography.fontFamily.semibold,
                }}
              >
                Go to Tavi
              </Text>
            )}
          </TouchableOpacity>

          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.caption,
              lineHeight: theme.typography.lineHeight.caption,
              fontFamily: theme.typography.fontFamily.regular,
              textAlign: 'center',
              marginTop: theme.spacing.sm,
              paddingHorizontal: theme.spacing.sm,
            }}
          >
            You can add more wallets, set budgets, and track expenses from the
            main screen.
          </Text>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  listContent: { flexGrow: 1 },
  listHeader: {
    paddingTop: 32,
    alignItems: 'stretch',
  },
  totalCard: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  bottomArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
});