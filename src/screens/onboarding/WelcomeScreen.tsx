import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { OnboardingStackParamList } from '@/types/navigation';
import { useTheme } from '@/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const theme = useTheme();

  const handleGetStarted = () => {
    navigation.navigate('PersonaSelect');
  };

  const handleTermsPress = () => {
    Linking.openURL('https://gettavi.app/terms');
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.brand }]}
      edges={['top', 'bottom']}
    >
      <StatusBar style="light" />

      <View style={styles.mascotArea}>
        <View
          style={[
            styles.mascotPlaceholder,
            { backgroundColor: theme.colors.accentSubtle },
          ]}
        />
      </View>

      <View
        style={[
          styles.textArea,
          { paddingHorizontal: theme.spacing.xl },
        ]}
      >
        <Text
          style={[
            styles.centered,
            {
              color: theme.colors.textInverse,
              fontSize: theme.typography.fontSize.heading1,
              lineHeight: theme.typography.lineHeight.heading1,
              fontFamily: theme.typography.fontFamily.semibold,
            },
          ]}
        >
          {'Your money. Your phone.\nNobody else.'}
        </Text>

        <Text
          style={[
            styles.centered,
            {
              color: theme.colors.textInverse,
              fontSize: theme.typography.fontSize.body,
              lineHeight: theme.typography.lineHeight.body,
              fontFamily: theme.typography.fontFamily.regular,
              opacity: 0.85,
            },
          ]}
        >
          Tavi keeps your finances private and stored only on your device.
          No account needed. No data shared. Ever.
        </Text>

        <Text
          style={[
            styles.centered,
            {
              color: theme.colors.textInverse,
              fontSize: theme.typography.fontSize.caption,
              lineHeight: theme.typography.lineHeight.caption,
              fontFamily: theme.typography.fontFamily.regular,
              opacity: 0.65,
            },
          ]}
        >
          Your financial data never leaves your phone unless you choose to
          back it up yourself.
        </Text>
      </View>

      <View
        style={[
          styles.bottomArea,
          { paddingHorizontal: theme.spacing.base },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: theme.colors.accentMain,
              borderRadius: theme.radius.medium,
            },
          ]}
          onPress={handleGetStarted}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Get Started"
        >
          <Text
            style={{
              color: theme.colors.textInverse,
              fontSize: theme.typography.fontSize.bodyLarge,
              lineHeight: theme.typography.lineHeight.bodyLarge,
              fontFamily: theme.typography.fontFamily.semibold,
            }}
          >
            Get Started
          </Text>
        </TouchableOpacity>

        <Text
          style={[
            styles.centered,
            {
              color: theme.colors.textInverse,
              fontSize: theme.typography.fontSize.label,
              lineHeight: theme.typography.lineHeight.label,
              fontFamily: theme.typography.fontFamily.regular,
              opacity: 0.5,
              marginTop: theme.spacing.sm,
            },
          ]}
        >
          {'By continuing, you agree to our '}
          <Text
            style={[
              styles.termsLink,
              { color: theme.colors.textInverse },
            ]}
            onPress={handleTermsPress}
            accessibilityRole="link"
          >
            Terms of Use
          </Text>
          {'.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mascotArea: {
    flex: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 9999,
  },
  textArea: {
    flex: 4,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  centered: {
    textAlign: 'center',
  },
  bottomArea: {
    flex: 2,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
  },
  button: {
    width: '100%',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsLink: {
    textDecorationLine: 'underline',
  },
});