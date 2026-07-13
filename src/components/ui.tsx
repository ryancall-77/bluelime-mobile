// Small shared UI primitives for Bluelime Deals — themed for the single dark
// brand palette. Keeps screens declarative.

import React from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps,
  View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, space } from '@/lib/theme';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={['top', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

export function Button({
  title, onPress, loading, disabled, variant = 'primary', style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'accent' | 'outline' | 'danger';
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  const bg =
    variant === 'primary' ? colors.blue
    : variant === 'accent' ? colors.lime
    : variant === 'danger' ? 'transparent'
    : 'transparent';
  const borderColor = variant === 'danger' ? colors.danger : colors.border;
  const textColor =
    variant === 'accent' ? colors.bg
    : variant === 'outline' ? colors.text
    : variant === 'danger' ? colors.danger
    : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        (variant === 'outline' || variant === 'danger') && { borderWidth: 1, borderColor },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: space.md }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function VerifiedBadge({ small }: { small?: boolean }) {
  return (
    <View style={[styles.badge, small && { paddingVertical: 2, paddingHorizontal: 6 }]}>
      <Text style={[styles.badgeText, small && { fontSize: font.tiny }]}>✓ Verified by Bluelime</Text>
    </View>
  );
}

export function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active ? styles.pillActive : null]}
    >
      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.blue} size="large" />
      {label ? <Text style={styles.dim}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={[styles.dim, { textAlign: 'center', marginTop: space.sm }]}>{body}</Text> : null}
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  btn: {
    height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  btnText: { fontSize: font.body, fontWeight: '700' },
  label: { color: colors.textDim, fontSize: font.small, marginBottom: space.xs, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    color: colors.text, paddingHorizontal: space.md, paddingVertical: 12, fontSize: font.body,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: space.lg,
  },
  badge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(125,226,75,0.15)', borderColor: colors.lime,
    borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4,
  },
  badgeText: { color: colors.lime, fontSize: font.small, fontWeight: '700' },
  pill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 8, marginRight: space.sm, marginBottom: space.sm,
    backgroundColor: colors.surfaceAlt,
  },
  pillActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  pillText: { color: colors.textDim, fontSize: font.small, fontWeight: '600' },
  pillTextActive: { color: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  dim: { color: colors.textDim, fontSize: font.body, marginTop: space.md },
  emptyTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', textAlign: 'center' },
  error: { color: colors.danger, fontSize: font.small, marginBottom: space.md },
});
