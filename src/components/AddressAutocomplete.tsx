import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { placesAutocomplete, type PlacePrediction } from '@/lib/api';
import { colors, radius, space, font } from '@/lib/theme';

// Intelligent property-address field. As the user types (debounced), it asks the
// server-proxied Google Places endpoint for US street-address suggestions and
// shows a tap-to-fill dropdown — same experience as the web/extension form.
//
// Degrades gracefully: if the endpoint errors or returns nothing, it's just a
// normal text input, so a run is never blocked by autocomplete being down.

// Opaque per-address session token (groups keystrokes into one billed Places
// session). Any unique string works — no crypto needed.
function newSessionToken(): string {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Google returns "123 Main St, Tampa, FL 33601, USA" — drop the trailing country.
function cleanAddress(desc: string): string {
  return desc.replace(/,\s*USA$/i, '').trim();
}

export function AddressAutocomplete({
  value,
  onChangeText,
  onSelect,
  label,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSelect?: (t: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const [preds, setPreds] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const focused = useRef(false);
  const justSelected = useRef(false);
  const sessionRef = useRef<string>(newSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Don't re-query the value we just injected from a tapped suggestion.
    if (justSelected.current) { justSelected.current = false; return; }
    if (!focused.current) return;

    const q = value.trim();
    if (q.length < 3) { setPreds([]); setOpen(false); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await placesAutocomplete(q, sessionRef.current);
        const list = res.predictions || [];
        setPreds(list);
        setOpen(list.length > 0 && focused.current);
      } catch {
        setPreds([]);
        setOpen(false); // graceful: stays a plain text field
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  const choose = (p: PlacePrediction) => {
    const addr = cleanAddress(p.description);
    justSelected.current = true;
    onChangeText(addr);
    onSelect?.(addr);
    setOpen(false);
    setPreds([]);
    // Rotate the session token after a completed selection (Places best practice).
    sessionRef.current = newSessionToken();
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => { focused.current = true; if (preds.length) setOpen(true); }}
          // Delay the close so a suggestion tap registers before blur hides it.
          onBlur={() => { focused.current = false; setTimeout(() => setOpen(false), 150); }}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="street-address"
          style={styles.input}
        />
        {loading ? <ActivityIndicator style={styles.spin} color={colors.blue} size="small" /> : null}
      </View>

      {open && preds.length > 0 ? (
        <View style={styles.dropdown}>
          {preds.slice(0, 5).map((p) => (
            <Pressable
              key={p.place_id || p.description}
              onPress={() => choose(p)}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <Text style={styles.itemText} numberOfLines={1}>{cleanAddress(p.description)}</Text>
            </Pressable>
          ))}
          <Text style={styles.attrib}>Powered by Google</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  label: { color: colors.textDim, fontSize: font.small, marginBottom: space.xs, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    color: colors.text, paddingHorizontal: space.md, paddingVertical: 12, fontSize: font.body, paddingRight: 40,
  },
  spin: { position: 'absolute', right: 12, top: 0, bottom: 0 },
  dropdown: {
    marginTop: 4, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, overflow: 'hidden',
  },
  item: { paddingHorizontal: space.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemPressed: { backgroundColor: colors.surfaceAlt },
  itemText: { color: colors.text, fontSize: font.body },
  attrib: { color: colors.textFaint, fontSize: font.tiny, textAlign: 'right', paddingHorizontal: space.md, paddingVertical: 6 },
});
