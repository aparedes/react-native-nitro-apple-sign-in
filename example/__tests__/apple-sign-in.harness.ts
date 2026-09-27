import { Platform } from 'react-native';
import { describe, expect, it } from 'react-native-harness';
import {
  AppleSignIn,
  AppleSignInError,
  getAppleCredentialState,
  signInWithApple,
} from 'react-native-nitro-apple-sign-in';

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  throw new Error('expected the promise to reject');
}

function withTimeout<T>(promise: Promise<T>, ms = 15_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function expectUnsupported(promise: Promise<unknown>) {
  const error = await rejection(withTimeout(promise));
  expect(error instanceof AppleSignInError).toBe(true);
  expect((error as AppleSignInError).code).toBe('unsupported');
}

describe('apple sign in (no system sheet)', () => {
  it('reports support per platform', () => {
    expect(AppleSignIn.isSupported).toBe(Platform.OS === 'ios');
  });
});

// Android has no native Sign in with Apple support, so every entry point rejects
// with `unsupported` — this exercises the JNI error transport end to end without
// opening any UI. iOS is intentionally not exercised here: `signInWithApple` opens
// a system sheet and depends on the simulator's signed-in Apple Account, which
// would hang or flake a CI run.
if (Platform.OS === 'android') {
  describe('apple sign in (android unsupported)', () => {
    it('signInWithApple rejects with unsupported', async () => {
      await expectUnsupported(signInWithApple());
    });

    it('getAppleCredentialState rejects with unsupported', async () => {
      await expectUnsupported(getAppleCredentialState('x'));
    });
  });
}
