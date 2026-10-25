import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { migrate } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { I18nProvider, useI18n } from '@/i18n';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="flashcards.db" onInit={migrate}>
        <I18nProvider>
          <Navigation />
        </I18nProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const { t } = useI18n();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          background: theme.background,
          card: theme.background,
          primary: theme.primary,
          text: theme.text,
          border: theme.border,
        },
      }}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: theme.primary,
          headerTitleStyle: { color: theme.text, fontWeight: '700' },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="deck/[id]" options={{ title: '' }} />
        <Stack.Screen name="folder/[id]" options={{ title: '' }} />
        <Stack.Screen name="card/[id]" options={{ title: t('editor.title') }} />
        <Stack.Screen name="session/[deckId]" options={{ title: t('session.title') }} />
        <Stack.Screen name="ai-prompt" options={{ title: t('ai.title') }} />
      </Stack>
    </ThemeProvider>
  );
}
