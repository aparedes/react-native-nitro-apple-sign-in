# Example app

A minimal demo of `react-native-nitro-apple-sign-in`: shows platform support, runs
the Sign in with Apple flow, decodes the returned identity token's claims (no
signature check — see the in-app caption), and checks credential state.

## Prerequisites

- An App ID with **Sign in with Apple** enabled for your team, and a matching
  bundle id.
- A device or simulator signed in to an Apple Account (Settings ▸ your name).
  Without one, the sheet has nothing to authenticate with.

## Run it

```sh
env APPLE_TEAM_ID=<10-char team id> APPLE_BUNDLE_ID=<bundle id> bun run signing
bun run pod
bun run ios
```

`signing` writes `ios/Config/Signing.local.xcconfig` — it's gitignored, so every
developer/CI job supplies their own team id and bundle id.

## Harness tests

```sh
bun run test:harness:ios
bun run test:harness:android
```

`HARNESS_IOS_VERSION` overrides the iOS simulator runtime used by
`test:harness:ios` (default `26.4`, see `rn-harness.config.mjs`), e.g.:

```sh
env HARNESS_IOS_VERSION=27.0 bun run test:harness:ios
```

The harness suite only exercises the Android `unsupported` rejections and the
`isSupported` flag on both platforms — it never triggers the iOS system sheet,
since that would hang or flake an unattended run.
