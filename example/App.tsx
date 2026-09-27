import { useState } from 'react';
import {
  Button,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
} from 'react-native';
import {
  AppleSignIn,
  AppleSignInError,
  getAppleCredentialState,
  signInWithApple,
  type AppleAuthCredential,
} from 'react-native-nitro-apple-sign-in';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

/**
 * 16 random bytes as a hex string. `crypto.getRandomValues` is preferred when Hermes
 * exposes it; the `Math.random` fallback is demo-only and NOT cryptographically
 * secure. A real app should generate the nonce/state server-side or with a vetted
 * crypto library.
 */
function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  const globalCrypto = (
    globalThis as {
      crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array };
    }
  ).crypto;
  if (typeof globalCrypto?.getRandomValues === 'function') {
    globalCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function base64urlToBase64(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const paddingNeeded = (4 - (base64.length % 4)) % 4;
  return base64 + '='.repeat(paddingNeeded);
}

/**
 * Some Hermes builds don't expose a global `atob`, so this falls back to a small
 * hand-rolled base64 decoder when it's missing.
 */
function decodeBase64(base64: string): string {
  const globalAtob = (globalThis as { atob?: (data: string) => string }).atob;
  if (typeof globalAtob === 'function') return globalAtob(base64);

  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of base64.replace(/=+$/, '')) {
    const value = alphabet.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

type IdentityTokenClaims = {
  iss?: string;
  aud?: string;
  sub?: string;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  exp?: number;
  iat?: number;
};

/** Decodes the identity token's payload claims. There is no signature check. */
function decodeIdentityToken(
  identityToken: string,
): IdentityTokenClaims | undefined {
  const payload = identityToken.split('.')[1];
  if (payload === undefined) return undefined;
  try {
    return JSON.parse(decodeBase64(base64urlToBase64(payload)));
  } catch {
    return undefined;
  }
}

function truncate(value: string): string {
  return value.length > 24 ? `${value.slice(0, 24)}…` : value;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [user, setUser] = useState<string | undefined>(undefined);
  const [lastNonce, setLastNonce] = useState<string | undefined>(undefined);
  const [lastState, setLastState] = useState<string | undefined>(undefined);
  const [result, setResult] = useState('');

  async function run(flow: () => Promise<unknown>) {
    setResult('...');
    try {
      setResult(JSON.stringify(await flow(), null, 2));
    } catch (e) {
      const code =
        e instanceof AppleSignInError ? e.code : 'non-AppleSignInError';
      setResult(`${code}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const signIn = () =>
    run(async () => {
      const nonce = randomHex(16);
      const state = randomHex(16);
      setLastNonce(nonce);
      setLastState(state);

      const credential: AppleAuthCredential = await signInWithApple({
        scopes: ['email', 'fullName'],
        nonce,
        state,
      });
      setUser(credential.user);

      const claims = decodeIdentityToken(credential.identityToken);
      return {
        credential: {
          ...credential,
          identityToken: truncate(credential.identityToken),
          authorizationCode: truncate(credential.authorizationCode),
        },
        stateMatches: credential.state === state ? 'yes' : 'no',
        nonceMatches: claims?.nonce === nonce ? 'yes' : 'no',
        identityTokenClaims: claims && {
          iss: claims.iss,
          aud: claims.aud,
          sub: claims.sub,
          nonce: claims.nonce,
          email: claims.email,
          email_verified: claims.email_verified,
          is_private_email: claims.is_private_email,
          exp: claims.exp,
          iat: claims.iat,
        },
      };
    });

  const checkCredentialState = () =>
    run(() => getAppleCredentialState(user ?? 'android-test'));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Nitro Apple Sign In</Text>
        <Text>Platform: {Platform.OS}</Text>
        <Text>isSupported: {String(AppleSignIn.isSupported)}</Text>

        <Button title="Sign in with Apple" onPress={signIn} />
        <Button
          title="Credential state"
          onPress={checkCredentialState}
          disabled={Platform.OS === 'ios' && user === undefined}
        />

        <Text style={styles.caption}>
          The nonce/state above are random bytes generated on-device for this
          demo only — not a cryptographic implementation. The decoded identity
          token below has NOT had its signature verified; a real app must verify
          it server-side against Apple's public keys.
        </Text>

        {lastNonce !== undefined && (
          <Text selectable style={styles.mono}>
            nonce: {lastNonce}
            {'\n'}
            state: {lastState}
          </Text>
        )}

        <Text selectable style={styles.mono}>
          {result}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  caption: { fontSize: 12, fontStyle: 'italic' },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
});

export default App;
