import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { OnboardingStackParamList } from '@/types/navigation';
import { useTheme } from '@/theme';
import useOnboardingStore, { type IncomeType } from '@/store/useOnboardingStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PersonaSelect'>;

type PersonaOption = {
  key: IncomeType;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
};

const PERSONA_OPTIONS: PersonaOption[] = [
  {
    key: 'regular',
    icon: 'calendar-outline',
    title: 'I have a regular salary',
    description:
      'I get paid on a fixed schedule — weekly, bi-monthly, or monthly.',
  },
  {
    key: 'irregular',
    icon: 'trending-up-outline',
    title: 'My income varies',
    description:
      'I have a side hustle, freelance work, multiple income sources, or irregular pay.',
  },
];

export default function PersonaSelectScreen({ navigation }: Props) {
  const theme = useTheme();
  const setIncomeType = useOnboardingStore((state) => state.setIncomeType);

  const [selected, setSelected] = useState<IncomeType | null>(null);
  const continueOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(continueOpacity, {
      toValue: selected ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [selected, continueOpacity]);

  const handleContinue = () => {
    if (!selected) return;

    setIncomeType(selected);
    navigation.navigate('AddWallet', { isFirstWallet: true });
  };

  const handleSkip = () => {
    setIncomeType('irregular');
    navigation.navigate('AddWallet', { isFirstWallet: true });
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.bgPage }]}
      edges={['top', 'bottom']}
    >
      <StatusBar style="auto" />

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
          styles.headingArea,
          { paddingHorizontal: theme.spacing.base },
        ]}
      >
        <Text
          style={[
            styles.centered,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.heading1,
              lineHeight: theme.typography.lineHeight.heading1,
              fontFamily: theme.typography.fontFamily.semibold,
            },
          ]}
        >
          How does your income usually work?
        </Text>

        <Text
          style={[
            styles.centered,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.body,
              lineHeight: theme.typography.lineHeight.body,
              fontFamily: theme.typography.fontFamily.regular,
              marginTop: theme.spacing.sm,
            },
          ]}
        >
          This helps Tavi set things up in a way that makes sense for you.
          You can always change this later.
        </Text>
      </View>

      <View
        style={[
          styles.cardsArea,
          { paddingHorizontal: theme.spacing.base },
        ]}
      >
        {PERSONA_OPTIONS.map((option) => {
          const isSelected = selected === option.key;

          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.card,
                theme.shadows.card,
                {
                  backgroundColor: isSelected
                    ? theme.colors.accentSubtle
                    : theme.colors.bgCard,
                  borderRadius: theme.radius.medium,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected
                    ? theme.colors.accentMain
                    : theme.colors.border,
                  marginBottom: theme.spacing.base,
                },
              ]}
              onPress={() => setSelected(option.key)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={option.title}
            >
              <View
                style={[
                  styles.cardIconContainer,
                  { backgroundColor: theme.colors.accentSubtle },
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={22}
                  color={theme.colors.accentMain}
                />
              </View>

              <View style={styles.cardTextContainer}>
                <Text
                  style={{
                    color: theme.colors.textPrimary,
                    fontSize: theme.typography.fontSize.bodyLarge,
                    lineHeight: theme.typography.lineHeight.bodyLarge,
                    fontFamily: theme.typography.fontFamily.semibold,
                  }}
                >
                  {option.title}
                </Text>

                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: theme.typography.fontSize.body,
                    lineHeight: theme.typography.lineHeight.body,
                    fontFamily: theme.typography.fontFamily.regular,
                    marginTop: theme.spacing.xs,
                  }}
                >
                  {option.description}
                </Text>
              </View>

              {isSelected && (
                <View style={styles.checkmarkContainer}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.colors.accentMain}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        style={[
          styles.bottomArea,
          { paddingHorizontal: theme.spacing.base },
        ]}
      >
        <Animated.View
          style={[styles.continueWrapper, { opacity: continueOpacity }]}
          pointerEvents={selected ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: theme.colors.accentMain,
                borderRadius: theme.radius.medium,
              },
            ]}
            onPress={handleContinue}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text
              style={{
                color: theme.colors.textInverse,
                fontSize: theme.typography.fontSize.bodyLarge,
                lineHeight: theme.typography.lineHeight.bodyLarge,
                fontFamily: theme.typography.fontFamily.semibold,
              }}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={[styles.skipButton, { marginTop: theme.spacing.sm }]}
          onPress={handleSkip}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
        >
          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.label,
              lineHeight: theme.typography.lineHeight.label,
              fontFamily: theme.typography.fontFamily.regular,
            }}
          >
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mascotArea: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },
  mascotPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 9999,
  },
  headingArea: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  centered: {
    textAlign: 'center',
  },
  cardsArea: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  cardTextContainer: {
    flex: 1,
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  bottomArea: {
    paddingBottom: 32,
    alignItems: 'center',
  },
  continueWrapper: {
    width: '100%',
  },
  button: {
    width: '100%',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});