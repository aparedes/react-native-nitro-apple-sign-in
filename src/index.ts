import { NitroModules } from 'react-native-nitro-modules';

import { AppleSignInError } from './AppleSignInError';
import type {
  AppleAuthCredential,
  AppleAuthRequest,
  AppleCredentialState,
  NitroAppleSignIn,
} from './specs/nitro-apple-sign-in.nitro';

/** The raw typed singleton. Its rejections are plain Nitro `Error`s — prefer the wrappers below. */
export const AppleSignIn =
  NitroModules.createHybridObject<NitroAppleSignIn>('NitroAppleSignIn');

/** Primary API. Runs the Sign in with Apple sheet; every rejection is an `AppleSignInError`. */
export async function signInWithApple(
  request: AppleAuthRequest = {},
): Promise<AppleAuthCredential> {
  try {
    return await AppleSignIn.signIn(request);
  } catch (error) {
    throw AppleSignInError.from(error);
  }
}

/** Looks up the current Apple ID credential state; every rejection is an `AppleSignInError`. */
export async function getAppleCredentialState(
  user: string,
): Promise<AppleCredentialState> {
  try {
    return await AppleSignIn.getCredentialState(user);
  } catch (error) {
    throw AppleSignInError.from(error);
  }
}

export { AppleSignInError };
export type { AppleSignInErrorCode } from './AppleSignInError';
export type {
  AppleAuthCredential,
  AppleAuthFullName,
  AppleAuthRequest,
  AppleAuthScope,
  AppleCredentialState,
  AppleRealUserStatus,
  NitroAppleSignIn,
} from './specs/nitro-apple-sign-in.nitro';
