import type { HybridObject } from 'react-native-nitro-modules';

export type AppleAuthScope = 'email' | 'fullName';
export interface AppleAuthRequest {
  scopes?: AppleAuthScope[];
  /** Passed to ASAuthorizationAppleIDRequest.nonce verbatim — never hashed by the module. */
  nonce?: string;
  state?: string;
}
export interface AppleAuthFullName {
  givenName?: string;
  familyName?: string;
}
export type AppleRealUserStatus = 'unsupported' | 'unknown' | 'likelyReal';
export interface AppleAuthCredential {
  user: string;
  identityToken: string;
  authorizationCode: string;
  email?: string;
  fullName?: AppleAuthFullName;
  realUserStatus: AppleRealUserStatus;
  state?: string;
}
export type AppleCredentialState =
  | 'authorized'
  | 'revoked'
  | 'notFound'
  | 'transferred';

export interface NitroAppleSignIn extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  readonly isSupported: boolean;
  signIn(request: AppleAuthRequest): Promise<AppleAuthCredential>;
  getCredentialState(user: string): Promise<AppleCredentialState>;
}
