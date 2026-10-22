import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { migrate } from '@/db';
import { useTheme } from '@/hooks/use-theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="flashcards.db" onInit={migrate}>
        <ThemeProvider
          value={{
            ...base,
            colors: { ...base.colors, background: theme.background, card: theme.surface, primary: theme.primary, text: theme.text, border: theme.border },
          }}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShadowVisible: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="deck/[id]" options={{ title: '' }} />
            <Stack.Screen name="card/[id]" options={{ title: 'Card' }} />
            <Stack.Screen name="session/[deckId]" options={{ title: 'Study' }} />
            <Stack.Screen name="ai-prompt" options={{ title: 'Generate with AI' }} />
          </Stack>
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
