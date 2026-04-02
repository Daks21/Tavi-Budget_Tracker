import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

import db, { initializeDatabase } from './src/db';
import seedDatabase from './src/db/seed';

type AppState = 'loading' | 'ready' | 'error';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        if (isMounted) setAppState('loading');
        await initializeDatabase();
        await seedDatabase(db);
        if (isMounted) setAppState('ready');
      } catch (error) {
        console.error('[App] Initialization failed:', error);
        if (isMounted) setAppState('error');
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, [retryKey]);

  if (appState === 'loading') {
    return (
      <View style={styles.container}>
        <Text style={styles.appName}>Tavi</Text>
        <ActivityIndicator size="small" color="#38BFA7" style={styles.spinner} />
      </View>
    );
  }

  if (appState === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Something went wrong. Please restart the app.
        </Text>
        <TouchableOpacity
          style={styles.restartButton}
          onPress={() => setRetryKey((k) => k + 1)}
        >
          <Text style={styles.restartButtonText}>Restart</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.appName}>Tavi</Text>
      <Text style={styles.readyText}>Database ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B2B4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
  },
  spinner: {
    marginTop: 8,
  },
  readyText: {
    color: '#38BFA7',
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 32,
    marginBottom: 24,
  },
  restartButton: {
    backgroundColor: '#38BFA7',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  restartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});