# react-native-nitro-apple-sign-in

Sign in with Apple for bare React Native, built as a [Nitro Modules](https://nitro.margelo.com)
`HybridObject`. It wraps `AuthenticationServices` on iOS to run the native Sign in with Apple
sheet and read back the resulting credential. It is iOS-only — Android has a stub that rejects
every call with `unsupported`, and there is no web/OAuth fallback.

The module does **no cryptography and no server work**. It does not hash the nonce you pass it,
and it does not verify the identity token's signature. Both are the host app's / host server's
job — see [Nonce](#3-nonce) and [Server verification](#5-server-verification) below for exactly
what to do and copy.

**Requirements**

- iOS 16+ (native functionality is iOS-only)
- React Native 0.87, bare workflow (not Expo Go — this module needs `pod install`)
- `react-native-nitro-modules` `>=0.37.1 <0.38.0` (peer dependency)

## Contents

1. [Install](#1-install)
2. [Entitlement](#2-entitlement)
3. [Nonce](#3-nonce)
4. [Audience](#4-audience)
5. [Server verification](#5-server-verification)
6. [First authorization only](#6-first-authorization-only)
7. [Authorization code](#7-authorization-code)
8. [Credential state](#8-credential-state)
9. [Android](#9-android)
10. [Usage and errors](#10-usage-and-errors)
- [Error codes](#error-codes)
- [Troubleshooting](#troubleshooting)
- [API reference](#api-reference)
- [Development](#development)

## 1. Install

```sh
bun add react-native-nitro-apple-sign-in react-native-nitro-modules
```

Then:

```sh
cd ios && pod install
```

Minimum iOS 16.

## 2. Entitlement

Add the "Sign in with Apple" capability, which is `com.apple.developer.applesignin` =
`["Default"]` in the app's `.entitlements`, and enable it on the App ID in the developer portal.

Without it, sign-in fails with `unknown` (1000).

## 3. Nonce

The module passes `nonce` to `ASAuthorizationAppleIDRequest.nonce` **verbatim** and never hashes
it. The identity token's `nonce` claim is exactly the string you passed.

- The recommended pattern is: the server issues a random nonce (or its SHA-256), the app passes
  it through, and the server checks the claim.
- If you hash on the client, the server has to hash the same way.

## 4. Audience

A native identity token's `aud` is the **host app's bundle id**. It is not a Services ID, which
web OAuth uses. A server that also serves web Sign in with Apple must accept both audiences, or
verify them on separate endpoints.

## 5. Server verification

Verify the JWS against Apple's JWKS at `https://appleid.apple.com/auth/keys`:

- issuer `https://appleid.apple.com`, audience the bundle id, `exp`/`iat` checked
- the `nonce` claim equal to the expected nonce
- `sub` equal to `credential.user`

Example with [`jose`](https://github.com/panva/jose):

```ts
import { jwtVerify, createRemoteJWKSet } from 'jose';

const { payload } = await jwtVerify(
  identityToken,
  createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')),
  { issuer: 'https://appleid.apple.com', audience: '<bundle id>' },
);
```

Never trust the claims the app sends alongside the token.

## 6. First authorization only

Apple returns `email` and `fullName` **only on the first authorization** of the app by that
Apple Account.

- Persist them server-side on first sign-in.
- Later sign-ins return `undefined` for both, although the identity token still carries `email`
  if it was shared.
- To test again, the user removes the app under Settings → Apple Account → Sign in with Apple.

## 7. Authorization code

The authorization code is single-use and expires after 5 minutes. A server needs it (exchanged
at `https://appleid.apple.com/auth/token` with a client-secret JWT) to get a refresh token, and
needs that refresh token to **revoke** tokens when the user deletes their account (App Store
Review Guideline 5.1.1(v)).

## 8. Credential state

Call `getAppleCredentialState(user)` on app launch. On `revoked` or `notFound`, sign the user out
locally.

## 9. Android

`isSupported` is `false` and every method rejects with `unsupported`. The module has no web
fallback, so provide one yourself if you need it.

## 10. Usage and errors

Use `signInWithApple` and `getAppleCredentialState` as the primary API. Every rejection from
them is already an `AppleSignInError`.

```ts
import { signInWithApple, AppleSignInError } from 'react-native-nitro-apple-sign-in';

try {
  const credential = await signInWithApple({ scopes: ['email', 'fullName'], nonce });
} catch (e) {
  if (e instanceof AppleSignInError && e.code === 'canceled') return; // user dismissed the sheet — not an error
  throw e;
}
```

See [Error codes](#error-codes) below for the full `AppleSignInError.code` table.

The raw `AppleSignIn` singleton (the typed Nitro `HybridObject`) is available as a lower-level
escape hatch — `signInWithApple`/`getAppleCredentialState` are thin wrappers over its `signIn`
and `getCredentialState` methods. Its rejections are plain Nitro `Error`s, not
`AppleSignInError`s; normalize them yourself with `AppleSignInError.from(e)` if you call it
directly.

## Error codes

`AppleSignInError.code` is one of `'canceled' | 'failed' | 'invalidResponse' | 'notHandled' |
'unsupported' | 'unknown'`. Native errors arrive on the wire as `[AppleSignIn:<token>]
<message>`, and `AppleSignInError.from` maps `<token>` to `code` as follows:

| Native source | Token | `code` |
|---|---|---|
| `ASAuthorizationError.unknown` (1000) | `asauth-1000` | `unknown` |
| `ASAuthorizationError.canceled` (1001) | `asauth-1001` | `canceled` |
| `ASAuthorizationError.invalidResponse` (1002) | `asauth-1002` | `invalidResponse` |
| `ASAuthorizationError.notHandled` (1003) | `asauth-1003` | `notHandled` |
| `ASAuthorizationError.failed` (1004) | `asauth-1004` | `failed` |
| `ASAuthorizationError.notInteractive` (1005) | `asauth-1005` | `unknown` |
| Any other `ASAuthorizationError` code (newer SDKs, e.g. 1006+) | `asauth-<n>` | `unknown` |
| An `identityToken`/`authorizationCode` that is `nil` or not UTF-8 | `invalidResponse` | `invalidResponse` |
| A credential that is not an `ASAuthorizationAppleIDCredential` | `invalidResponse` | `invalidResponse` |
| A non-`ASAuthorizationError` `Error` | `unknown` | `unknown` |
| Android: every method | `unsupported` | `unsupported` |
| A second concurrent `signIn` call | — (in-flight) | `unknown`, message "A sign-in request is already in progress" |
| No token, or an unrecognised token | — | `unknown` |

A second `signIn()` call made while one is already in flight rejects immediately with that
message; the first call is **not** cancelled and keeps running.

## Troubleshooting

- A missing `com.apple.developer.applesignin` entitlement surfaces as `asauth-1000`
  (`unknown`), not `failed`.
- So does a simulator or device with no Apple Account signed in.
- A user dismissing the sheet gives `canceled`.

## API reference

```ts
/** The raw typed singleton. Its rejections are plain Nitro `Error`s — prefer the wrappers below. */
export const AppleSignIn: NitroAppleSignIn;

/** Primary API. Runs the Sign in with Apple sheet; every rejection is an `AppleSignInError`. */
export function signInWithApple(
  request?: AppleAuthRequest,
): Promise<AppleAuthCredential>;

/** Looks up the current Apple ID credential state; every rejection is an `AppleSignInError`. */
export function getAppleCredentialState(
  user: string,
): Promise<AppleCredentialState>;

export class AppleSignInError extends Error {
  readonly code: AppleSignInErrorCode;
  /** Normalises anything thrown by `AppleSignIn.signIn` / `getCredentialState`. Never throws. */
  static from(error: unknown): AppleSignInError;
}

type AppleSignInErrorCode =
  | 'canceled'
  | 'failed'
  | 'invalidResponse'
  | 'notHandled'
  | 'unsupported'
  | 'unknown';

type AppleAuthScope = 'email' | 'fullName';

interface AppleAuthRequest {
  scopes?: AppleAuthScope[];
  /** Passed to `ASAuthorizationAppleIDRequest.nonce` verbatim — never hashed by the module. */
  nonce?: string;
  state?: string;
}

interface AppleAuthFullName {
  givenName?: string;
  familyName?: string;
}

type AppleRealUserStatus = 'unsupported' | 'unknown' | 'likelyReal';

interface AppleAuthCredential {
  user: string;
  identityToken: string;
  authorizationCode: string;
  email?: string;
  fullName?: AppleAuthFullName;
  realUserStatus: AppleRealUserStatus;
  state?: string;
}

type AppleCredentialState = 'authorized' | 'revoked' | 'notFound' | 'transferred';

/** The typed Nitro HybridObject spec backing `AppleSignIn`. */
interface NitroAppleSignIn {
  readonly isSupported: boolean;
  signIn(request: AppleAuthRequest): Promise<AppleAuthCredential>;
  getCredentialState(user: string): Promise<AppleCredentialState>;
}
```

## Development

```sh
bun install

bun test src            # unit tests for the TypeScript layer
bun run typecheck       # tsc --noEmit
bun run build           # typecheck + bob build, produces lib/
bun run codegen         # nitrogen, then bun run build

bunx oxlint --deny-warnings
bunx oxfmt --check
```

`nitrogen/generated/` is committed. `bun run codegen` regenerates it — run it and commit the
diff whenever `src/specs/*.nitro.ts` changes.

### iOS XCTest

```sh
xcodebuild test \
  -workspace example/ios/NitroAppleSignInExample.xcworkspace \
  -scheme NitroAppleSignInExample \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  CODE_SIGNING_ALLOWED=NO
```

### react-native-harness suite

```sh
bun run --cwd example test:harness:ios
bun run --cwd example test:harness:android
```

`test:harness:ios` respects `HARNESS_IOS_VERSION` (default `26.4`), e.g.:

```sh
env HARNESS_IOS_VERSION=27.0 bun run --cwd example test:harness:ios
```

The harness suite only exercises the Android `unsupported` rejections and the `isSupported`
flag on both platforms — it never opens the iOS system sheet, since a real Apple Account
sign-in can't run unattended in CI.

### Running the example app

```sh
env APPLE_TEAM_ID=<10-char team id> APPLE_BUNDLE_ID=<bundle id> bun run --cwd example signing
bun run --cwd example pod
bun run --cwd example ios
```

`signing` writes `example/ios/Config/Signing.local.xcconfig`, which is gitignored — every
developer/CI job supplies their own team id and bundle id.
