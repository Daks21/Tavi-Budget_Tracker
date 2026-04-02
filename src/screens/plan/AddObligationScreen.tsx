import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PlanStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<PlanStackParamList, 'AddObligation'>;

export default function AddObligationScreen(_props: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>AddObligationScreen</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B2B4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
