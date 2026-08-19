import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  InteractionManager, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View,
  type StyleProp, type ViewStyle,
} from 'react-native';

// Drop-in replacement for KeyboardAvoidingView that actually clears the keyboard
// when it sits under a header.
//
// React Native's KeyboardAvoidingView computes its lift as
//   max(frame.y + frame.height - (keyboardFrame.screenY - keyboardVerticalOffset), 0)
// (node_modules/react-native/Libraries/Components/Keyboard/KeyboardAvoidingView.js).
// `frame` comes from its own onLayout and is PARENT-relative; keyboardFrame.screenY
// is SCREEN-relative. Mount one as a navigator scene root and frame.y reads 0 while
// its true screen origin is the header's height, so it under-lifts by exactly the
// header -- the CTA stays behind the keyboard (Ryan, 2026-08-18, on device).
// `behavior="height"` reads the same wrong frame, so it is not an escape hatch.
//
// keyboardVerticalOffset closes the gap, but every hardcoded value in this app was
// a guess: TopBar is insets.top + 6 + content, the native stack header is a
// different height again, messages/[id] adds a CONDITIONAL address bar above the
// KAV, and modals mount under yet another header. So measure where this view
// actually sits in the window and feed that back.
//
// Known limit: iOS's KeyboardAvoidingView subscribes only to keyboardWillShow, so
// an offset written during that event would race its own handler. Measurement
// therefore has to settle BEFORE the user taps a field -- which is why it happens
// on layout and after interactions, with the keyboard listener as a self-heal for
// the next open rather than the current one.

export function KeyboardLift({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const rootRef = useRef<View | null>(null);
  const [offset, setOffset] = useState(0);

  const measure = useCallback(() => {
    rootRef.current?.measureInWindow((_x, y) => {
      if (!Number.isFinite(y)) return;
      // Only commit real movement: measureInWindow runs on every layout pass and
      // an unguarded setState here is a render loop.
      setOffset((prev) => (Math.abs(prev - y) > 1 ? y : prev));
    });
  }, []);

  const onLayout = useCallback(() => {
    measure();
    // Modal routes animate in with a TRANSFORM, which does not re-fire onLayout,
    // and measureInWindow sees transforms -- so a measurement taken mid-transition
    // is wrong. Re-measure once the animation has settled.
    InteractionManager.runAfterInteractions(measure);
  }, [measure]);

  useEffect(() => {
    // Self-heal if something above us moved without a layout pass of ours.
    const sub = Keyboard.addListener('keyboardDidShow', measure);
    return () => sub.remove();
  }, [measure]);

  return (
    <View ref={rootRef} style={[styles.flex, style]} onLayout={onLayout} collapsable={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={offset}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
