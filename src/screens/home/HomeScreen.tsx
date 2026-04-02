// src/screens/home/HomeScreen.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import type { RootTabParamList } from '@/types/navigation';
import { useTheme } from '@/theme';

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

export default function HomeScreen(_props: Props) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bgPage,
        },
      ]}
    >
      <View
        style={{
          padding: theme.spacing.base,
        }}
      >
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.heading1,
            lineHeight: theme.typography.lineHeight.heading1,
            fontFamily: theme.typography.fontFamily.semibold,
          }}
        >
          Home
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
          Tavi – Budget Tracker
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});