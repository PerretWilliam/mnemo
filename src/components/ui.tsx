// Small set of themed building blocks shared by all screens.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextVariant = 'title' | 'heading' | 'body' | 'caption' | 'label';

export function T({ variant = 'body', color, style, ...rest }: TextProps & { variant?: TextVariant; color?: string }) {
  const theme = useTheme();
  const base = variant === 'caption' || variant === 'label' ? theme.textSecondary : theme.text;
  return <Text style={[styles[variant], { color: color ?? base }, style]} {...rest} />;
}

/** Scrollable page. `title` renders a large heading and pads for the status bar (tab screens have no header). */
export function Screen({ title, children, scroll = true }: { title?: string; children: ReactNode; scroll?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const padding = { padding: Spacing.lg, paddingTop: title ? insets.top + Spacing.lg : Spacing.lg, gap: Spacing.lg };
  const header = title ? <T variant="title">{title}</T> : null;
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: theme.background }, padding]}>
        {header}
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[padding, { paddingBottom: insets.bottom + Spacing.xxl }]}
      keyboardShouldPersistTaps="handled">
      {header}
      {children}
    </ScrollView>
  );
}

export function Surface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.surface, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.primary : variant === 'danger' ? theme.danger : theme.muted;
  const fg = variant === 'secondary' ? theme.text : theme.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}>
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const theme = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: Spacing.xs }}>
      {label ? <T variant="label">{label}</T> : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
          rest.multiline && { minHeight: 96, textAlignVertical: 'top' },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

/** Pressable list row with a title, an optional subtitle and an optional right-side text. */
export function Row({
  title,
  subtitle,
  right,
  onPress,
  onLongPress,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.muted : theme.surface, borderColor: theme.border },
      ]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T numberOfLines={2}>{title}</T>
        {subtitle ? (
          <T variant="caption" numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right ? <T variant="caption">{right}</T> : null}
    </Pressable>
  );
}

/** Segmented choice between a few options. */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.muted }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: theme.surface }]}>
            <T variant="label" color={active ? theme.text : theme.textSecondary}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <T variant="caption" style={{ textAlign: 'center', paddingVertical: Spacing.xxl }}>
      {text}
    </T>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}>
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

/** Promise-based Alert with custom buttons. Resolves with the pressed button's value. */
export function ask<V>(
  title: string,
  message: string,
  buttons: { text: string; value: V; style?: 'default' | 'cancel' | 'destructive' }[],
): Promise<V> {
  return new Promise((resolve) => {
    const cancel = buttons.find((b) => b.style === 'cancel');
    Alert.alert(
      title,
      message,
      buttons.map((b) => ({ text: b.text, style: b.style, onPress: () => resolve(b.value) })),
      { cancelable: !!cancel, onDismiss: () => cancel && resolve(cancel.value) },
    );
  });
}

export const confirm = (title: string, message: string, action = 'Delete') =>
  ask(title, message, [
    { text: 'Cancel', value: false, style: 'cancel' },
    { text: action, value: true, style: 'destructive' },
  ]);

/** Loads data when the screen gains focus, so lists refresh after editing elsewhere. Pass a memoized loader. */
export function useFocusData<D>(load: () => Promise<D>) {
  const [data, setData] = useState<D | null>(null);
  const reload = useCallback(() => {
    load().then(setData, (e: Error) => Alert.alert('Error', e.message));
  }, [load]);
  useFocusEffect(reload);
  return [data, reload] as const;
}

const styles = StyleSheet.create({
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  surface: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.md },
  button: {
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmented: { flexDirection: 'row', borderRadius: Radius.sm, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.sm - 2 },
});
