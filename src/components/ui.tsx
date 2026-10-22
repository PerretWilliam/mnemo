// Small set of themed building blocks shared by all screens.
import { useFocusEffect } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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

import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

/** An icon: Material Symbols on Android (`md`), SF Symbols on iOS (`sf`). Bundled, works offline. */
export type IconName = { md: AndroidSymbol; sf: SFSymbol };

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const theme = useTheme();
  return <SymbolView name={{ android: name.md, ios: name.sf }} size={size} tintColor={color ?? theme.text} />;
}

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
  const header = title ? (
    <T variant="title" color={theme.primary}>
      {title}
    </T>
  ) : null;
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

/** Card container. `tint` gives it a soft colored background and border instead of the neutral surface. */
export function Surface({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  const theme = useTheme();
  const colors = tint
    ? { backgroundColor: withAlpha(tint, 0.12), borderColor: withAlpha(tint, 0.35) }
    : { backgroundColor: theme.surface, borderColor: theme.border };
  return <View style={[styles.surface, colors, style]}>{children}</View>;
}

type ButtonProps = {
  title?: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, icon, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.primary : variant === 'danger' ? theme.danger : theme.primarySoft;
  const fg = variant === 'secondary' ? theme.primary : theme.onPrimary;
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
      {icon ? <Icon name={icon} color={fg} size={20} /> : null}
      {title ? <Text style={[styles.buttonText, { color: fg }]}>{title}</Text> : null}
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

/** Pressable list row. `accent` draws a colored bar on the left (e.g. the deck color). */
export function Row({
  title,
  subtitle,
  right,
  accent,
  onPress,
  onLongPress,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  accent?: string;
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
      {accent ? <View style={[styles.rowAccent, { backgroundColor: accent }]} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T numberOfLines={2}>{title}</T>
        {subtitle ? (
          <T variant="caption" numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right ? (
        <View style={[styles.badge, { backgroundColor: withAlpha(accent ?? theme.primary, 0.14) }]}>
          <T variant="label" color={accent ?? theme.primary}>
            {right}
          </T>
        </View>
      ) : null}
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
            style={[styles.segment, active && { backgroundColor: theme.primary }]}>
            <T variant="label" color={active ? theme.onPrimary : theme.textSecondary}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Dropdown: a field that opens a list of options in a bottom sheet. */
export function Select<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ gap: Spacing.xs }}>
      {label ? <T variant="label">{label}</T> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[styles.input, styles.select, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <T style={{ flex: 1 }}>{current?.label ?? value}</T>
        <Icon name={{ md: 'expand_more', sf: 'chevron.down' }} color={theme.primary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Inner Pressable swallows taps so only the backdrop closes the sheet. */}
          <Pressable style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + Spacing.md }]}>
            {label ? (
              <T variant="heading" style={{ padding: Spacing.lg }}>
                {label}
              </T>
            ) : null}
            <ScrollView>
              {options.map((o) => {
                const selected = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      (selected || pressed) && { backgroundColor: theme.primarySoft },
                    ]}>
                    <T style={{ flex: 1 }} color={selected ? theme.primary : theme.text}>
                      {o.label}
                    </T>
                    {selected ? <Icon name={{ md: 'check', sf: 'checkmark' }} color={theme.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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

/** Destructive confirmation. Labels come from the caller so they are translated. */
export const confirm = (title: string, message: string, labels: { cancel: string; action: string }) =>
  ask(title, message, [
    { text: labels.cancel, value: false, style: 'cancel' },
    { text: labels.action, value: true, style: 'destructive' },
  ]);

/** Loads data when the screen gains focus, so lists refresh after editing elsewhere. Pass a memoized loader. */
export function useFocusData<D>(load: () => Promise<D>) {
  const { t } = useI18n();
  const errorTitle = t('common.error');
  const [data, setData] = useState<D | null>(null);
  const reload = useCallback(() => {
    load().then(setData, (e: Error) => Alert.alert(errorTitle, e.message));
  }, [load, errorTitle]);
  useFocusEffect(reload);
  return [data, reload] as const;
}

const styles = StyleSheet.create({
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  surface: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.md },
  button: {
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 16,
  },
  select: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  rowAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  segmented: { flexDirection: 'row', borderRadius: Radius.sm, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.sm - 2 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
  },
});
