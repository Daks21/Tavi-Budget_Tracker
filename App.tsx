//  app.tsx 
 
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import useWalletStore from '@/store/useWalletStore';
import { userProfile } from '@/db/schema';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import db, { initializeDatabase } from '@/db';
import seedDatabase from '@/db/seed';
import RootNavigator from '@/navigation';
import { ThemeProvider, useTheme } from '@/theme';

type AppState = 'loading' | 'ready' | 'error';

function AppContent() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [retryKey, setRetryKey] = useState(0);
  const theme = useTheme();
  const initializePrivacyMode = useWalletStore(
    (state) => state.initializePrivacyMode
  );

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    let isMounted = true;

  async function initialize() {
    try {
      if (isMounted) {
        setAppState('loading');
      }

      await initializeDatabase();
      await seedDatabase(db);

      const existingProfiles = await db.select().from(userProfile).limit(1);

      const privacyModeFromDb =
        existingProfiles.length > 0
          ? existingProfiles[0].privacy_mode === 1
          : false;

      initializePrivacyMode(privacyModeFromDb);

      if (isMounted) {
        setAppState('ready');
      }
    } catch (error) {
      console.error('[App] Initialization failed:', error);

      if (isMounted) {
        setAppState('error');
      }
    }
  }

    initialize();

    return () => {
      isMounted = false;
    };
  }, [retryKey, initializePrivacyMode]);

  if (!fontsLoaded || appState === 'loading') {
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor: theme.colors.brand,
            padding: theme.spacing.xl,
          },
        ]}
      >
        <Text
          style={{
            color: theme.colors.textInverse,
            fontSize: theme.typography.fontSize.display,
            lineHeight: theme.typography.lineHeight.display,
            fontFamily: theme.typography.fontFamily.bold,
            letterSpacing: theme.typography.letterSpacing.normal,
          }}
        >
          Tavi
        </Text>

        <ActivityIndicator
          size="small"
          color={theme.colors.textInverse}
          style={{ marginTop: theme.spacing.base }}
        />
      </View>
    );
  }

  if (appState === 'error') {
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor: theme.colors.brand,
            padding: theme.spacing.xl,
          },
        ]}
      >
        <Text
          style={{
            color: theme.colors.textInverse,
            fontSize: theme.typography.fontSize.bodyLarge,
            lineHeight: theme.typography.lineHeight.bodyLarge,
            fontFamily: theme.typography.fontFamily.medium,
            textAlign: 'center',
            marginBottom: theme.spacing.lg,
          }}
        >
          Something went wrong. Please restart the app.
        </Text>

        <TouchableOpacity
          onPress={() => setRetryKey((k) => k + 1)}
          style={{
            backgroundColor: theme.colors.accentMain,
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.radius.medium,
          }}
        >
          <Text
            style={{
              color: theme.colors.textInverse,
              fontSize: theme.typography.fontSize.body,
              lineHeight: theme.typography.lineHeight.body,
              fontFamily: theme.typography.fontFamily.semibold,
            }}
          >
            Restart
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});