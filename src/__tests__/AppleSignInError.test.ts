import { describe, expect, test } from 'bun:test';

import { AppleSignInError } from '../AppleSignInError';

describe('asauth-N mapping', () => {
  test.each([
    ['asauth-1000', 'unknown'],
    ['asauth-1001', 'canceled'],
    ['asauth-1002', 'invalidResponse'],
    ['asauth-1003', 'notHandled'],
    ['asauth-1004', 'failed'],
    ['asauth-1005', 'unknown'],
  ] as const)('%s -> %s', (token, code) => {
    const error = AppleSignInError.from(
      new Error(`[AppleSignIn:${token}] boom`),
    );
    expect(error.code).toBe(code);
  });

  test.each(['asauth-1006', 'asauth-1099'])(
    'unmapped %s -> unknown',
    (token) => {
      const error = AppleSignInError.from(
        new Error(`[AppleSignIn:${token}] boom`),
      );
      expect(error.code).toBe('unknown');
    },
  );
});

describe('named tokens', () => {
  test.each(['invalidResponse', 'unsupported', 'unknown'] as const)(
    '%s maps to itself',
    (token) => {
      const error = AppleSignInError.from(
        new Error(`[AppleSignIn:${token}] boom`),
      );
      expect(error.code).toBe(token);
    },
  );

  test('unknown named token (bogus) -> unknown', () => {
    const error = AppleSignInError.from(new Error('[AppleSignIn:bogus] boom'));
    expect(error.code).toBe('unknown');
  });
});

describe('message stripping', () => {
  test('keeps the Nitro prefix, strips the token, maps canceled', () => {
    const error = AppleSignInError.from(
      new Error(
        "NitroAppleSignIn.signIn(...): [AppleSignIn:asauth-1001] The operation couldn't be completed.",
      ),
    );
    expect(error.code).toBe('canceled');
    expect(error.message).toBe(
      "NitroAppleSignIn.signIn(...): The operation couldn't be completed.",
    );
  });

  test('fbjni-style message maps unsupported', () => {
    const error = AppleSignInError.from(
      new Error(
        'java.lang.Error: [AppleSignIn:unsupported] Sign in with Apple is only available on iOS',
      ),
    );
    expect(error.code).toBe('unsupported');
  });

  test('marker stripped with no leading space', () => {
    const error = AppleSignInError.from(
      new Error('[AppleSignIn:asauth-1001] Canceled'),
    );
    expect(error.message).toBe('Canceled');
  });

  test('marker-only message falls back to original text', () => {
    const error = AppleSignInError.from(new Error('[AppleSignIn:unknown]'));
    expect(error.message).toBe('[AppleSignIn:unknown]');
  });

  test('no token -> unknown, message kept exactly', () => {
    const error = AppleSignInError.from(new Error('Something went wrong'));
    expect(error.code).toBe('unknown');
    expect(error.message).toBe('Something went wrong');
  });
});

describe('non-Error inputs', () => {
  test('undefined -> unknown / Unknown error', () => {
    const error = AppleSignInError.from(undefined);
    expect(error.code).toBe('unknown');
    expect(error.message).toBe('Unknown error');
  });

  test('string -> unknown with that string as the message', () => {
    const error = AppleSignInError.from('plain string error');
    expect(error.code).toBe('unknown');
    expect(error.message).toBe('plain string error');
  });

  test('42 -> unknown', () => {
    const error = AppleSignInError.from(42);
    expect(error.code).toBe('unknown');
    expect(error.message).toBe('Unknown error');
  });
});

describe('identity and shape', () => {
  test('an existing AppleSignInError is returned as the same instance', () => {
    const original = new AppleSignInError('canceled', 'already normalized');
    expect(AppleSignInError.from(original)).toBe(original);
  });

  test('name is AppleSignInError and instanceof Error', () => {
    const error = new AppleSignInError('unknown', 'boom');
    expect(error.name).toBe('AppleSignInError');
    expect(error).toBeInstanceOf(Error);
  });
});
