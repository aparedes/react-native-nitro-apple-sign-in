import { beforeEach, describe, expect, mock, test } from 'bun:test';

const fake = {
  isSupported: true,
  signIn: mock(),
  getCredentialState: mock(),
};

mock.module('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: () => fake },
}));

// Must load after mock.module: index.ts creates the HybridObject at import time.
const mod = await import('../index');

beforeEach(() => {
  fake.isSupported = true;
  fake.signIn.mockReset();
  fake.getCredentialState.mockReset();
});

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected rejection');
}

describe('AppleSignIn', () => {
  test('is the fake hybrid object', () => {
    expect(mod.AppleSignIn).toBe(fake as never);
  });
});

describe('signInWithApple', () => {
  test('resolves with the credential from signIn and passes the request through', async () => {
    const credential = {
      user: 'abc',
      identityToken: 'tok',
      authorizationCode: 'code',
      realUserStatus: 'unknown' as const,
    };
    fake.signIn.mockResolvedValue(credential);
    const request = { scopes: ['email' as const], nonce: 'n', state: 's' };

    const result = await mod.signInWithApple(request);

    expect(result).toBe(credential as never);
    expect(fake.signIn).toHaveBeenCalledWith(request);
  });

  test('with no argument, signIn receives {}', async () => {
    fake.signIn.mockResolvedValue({
      user: 'abc',
      identityToken: 'tok',
      authorizationCode: 'code',
      realUserStatus: 'unknown' as const,
    });

    await mod.signInWithApple();

    expect(fake.signIn).toHaveBeenCalledWith({});
  });

  test('rejection with a Nitro-prefixed asauth-1001 message -> canceled', async () => {
    fake.signIn.mockRejectedValue(
      new Error(
        "NitroAppleSignIn.signIn(...): [AppleSignIn:asauth-1001] The operation couldn't be completed.",
      ),
    );

    const error = (await rejection(mod.signInWithApple())) as InstanceType<
      typeof mod.AppleSignInError
    >;

    expect(error).toBeInstanceOf(mod.AppleSignInError);
    expect(error.code).toBe('canceled');
    expect(error.message).toBe(
      "NitroAppleSignIn.signIn(...): The operation couldn't be completed.",
    );
  });

  test('rejection with no token -> unknown, message kept', async () => {
    fake.signIn.mockRejectedValue(new Error('Something went wrong'));

    const error = (await rejection(mod.signInWithApple())) as InstanceType<
      typeof mod.AppleSignInError
    >;

    expect(error).toBeInstanceOf(mod.AppleSignInError);
    expect(error.code).toBe('unknown');
    expect(error.message).toBe('Something went wrong');
  });

  test('synchronous throw from signIn -> rejected promise with invalidResponse', async () => {
    fake.signIn.mockImplementation(() => {
      throw new Error('[AppleSignIn:invalidResponse] bad');
    });

    const error = (await rejection(mod.signInWithApple())) as InstanceType<
      typeof mod.AppleSignInError
    >;

    expect(error).toBeInstanceOf(mod.AppleSignInError);
    expect(error.code).toBe('invalidResponse');
  });
});

describe('getAppleCredentialState', () => {
  test('resolves with the state from getCredentialState and passes user through', async () => {
    fake.getCredentialState.mockResolvedValue('authorized');

    const result = await mod.getAppleCredentialState('user-1');

    expect(result).toBe('authorized');
    expect(fake.getCredentialState).toHaveBeenCalledWith('user-1');
  });

  test('rejection -> unsupported', async () => {
    fake.getCredentialState.mockRejectedValue(
      new Error(
        '[AppleSignIn:unsupported] Sign in with Apple is only available on iOS',
      ),
    );

    const error = (await rejection(
      mod.getAppleCredentialState('user-1'),
    )) as InstanceType<typeof mod.AppleSignInError>;

    expect(error).toBeInstanceOf(mod.AppleSignInError);
    expect(error.code).toBe('unsupported');
  });
});
