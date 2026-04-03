import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { OnboardingStackParamList } from '@/types/navigation';
import { useTheme, type Theme } from '@/theme';
import useOnboardingStore from '@/store/useOnboardingStore';
import WalletPickerForm, {
  type WalletFormData,
} from '@/components/onboarding/WalletPickerForm';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AddWallet'>;

function ProgressDots({
  total,
  filled,
  theme,
}: {
  total: number;
  filled: number;
  theme: Theme;
}) {
  return (
    <View style={dotStyles.container}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            dotStyles.dot,
            {
              backgroundColor:
                index < filled ? theme.colors.accentMain : theme.colors.border,
            },
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
  dot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
  },
});

export default function AddWalletScreen({ navigation }: Props) {
  const theme = useTheme();
  const addWallet = useOnboardingStore((state) => state.addWallet);

  const handleSubmit = (data: WalletFormData) => {
    addWallet(data);
    navigation.navigate('AddMoreWallets');
  };

  const handleCancel = () => {
    navigation.navigate('FirstDashboard');
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

        <ProgressDots total={5} filled={3} theme={theme} />

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
            Add Your First Wallet
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
            Where do you keep most of your money?
          </Text>

          <WalletPickerForm
            submitLabel="Add Wallet"
            cancelLabel="I'll add this later"
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});