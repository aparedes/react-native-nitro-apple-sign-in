# react-native-nitro-apple-sign-in v1 Orchestration Plan

**Date:** 2026-09-27 · **Branch:** main · **Commit:** none (the repo has no commits yet; the empty-tree hash `4b825dc642cb6eb9a060e54bf8d69288fbee4904` is the diff base) · **Research:** `tasks/2026-09-26-nitro-apple-sign-in-v1/research.md` (commit: none. The reference repos are stamped inside it. Re-checked 2026-09-27: `PK` is clean at `3084815`, so there is no drift.)

## Overview

Build `react-native-nitro-apple-sign-in` v1 from scratch in this empty repo. It is a Nitro
HybridObject that wraps Sign in with Apple (`AuthenticationServices`) for bare React Native.
It is native on iOS 16+ only; on Android it has a stub that rejects with `unsupported`. It
ships typed JS wrappers (`signInWithApple`, `getAppleCredentialState`) that reject only with
`AppleSignInError`.

The canonical spec is
`/Volumes/CaseSensitive/GitHub/football/wc2018/tasks/2026-09-25-mobile-app-nitro-first/specs/react-native-nitro-apple-sign-in.md`
(called **SPEC** below, 561 lines). Where the two disagree, the research doc's
`## Follow-up` section and the "Decisions that override SPEC" table below win over SPEC.

Path shorthands used in every phase:
- **SPEC**: the spec path above
- **PK**: `/Volumes/CaseSensitive/GitHub/react-native-nitro-passkeys`, pinned at commit
  `3084815` (clean working tree). This is the **scaffold template**: copy files from it with
  `git -C <PK> show 3084815:<path>` or `git -C <PK> archive 3084815 <paths> | tar -x -C <dest>`.
  Don't copy from its working tree or its `node_modules`.
- **Rename rule**: every copy from PK applies these case-sensitive substitutions, then a grep
  confirms nothing is left over (`grep -rniE 'passkey|webauthn|simplewebauthn|PASSKEYS_RP_ID|SERVER_URL' <copied files>`
  must print nothing, except where a phase says to keep something):
  - `NitroPasskeysExample` → `NitroAppleSignInExample`
  - `nitropasskeysexample` → `nitroapplesigninexample`
  - `react-native-nitro-passkeys` → `react-native-nitro-apple-sign-in`
  - `NitroPasskeys` → `NitroAppleSignIn`
  - `nitropasskeys` → `nitroapplesignin`

## Current State Analysis

- The repo is empty. `main` has no commits, and the only content is `tasks/`.
- PK was built on 2026-09-25/26 from a sibling spec. It already has almost every mechanism
  this module needs, working and verified:
  - the exact `package.json` versions, and the podspec that strips the prerelease suffix
  - the `[Prefix:token]` error format
  - the retained-delegate `NSLock` in-flight guard, and the foreground-scene window anchor
  - a `bun test src` suite that uses `mock.module`
  - an app-hosted XCTest target with `inherit! :search_paths`
  - a UIScene example app on RN 0.87.1 with hoisted Gradle paths
  - harness config
  - CI workflows
- PK also carries things this module does **not** need, which must be dropped:
  - `@simplewebauthn/server`, `example/server/`, `example/src/config.ts`
  - `validate.ts`, `response.ts`, `types.ts`
  - `Base64URL.swift`, `PasskeyJSON.swift`
  - the androidx.credentials and coroutines deps, and JUnit (`android/src/test`)
  - the Associated Domains entitlement, `PASSKEYS_RP_ID`
  - `scripts/add-ios-test-target.rb`. The target already exists in the copied project, so the
    script is not needed.
- Toolchain on this machine:
  - Xcode 27.0, an `iPhone 17` simulator (iOS 27.0 runtime)
  - bun 1.4.2
  - swiftlint installed at `/opt/homebrew/bin/swiftlint`
  - CI stays on Xcode 26.4 / iOS 26.4.

## Desired End State

- These commands all pass:
  - `bun install && bun run build` (produces `lib/`)
  - `bun test src`
  - `bun run typecheck`
  - `bunx oxlint --deny-warnings`
  - `bunx oxfmt --check`
- The example app (`example/`, RN 0.87.1, UIScene, iOS 16.0) builds on both platforms.
  - On iOS with a real team, bundle id and signed-in Apple Account, it runs the Sign in with
    Apple sheet. It shows the credential, the decoded identity-token claims, `nonce` and
    `state` matches, and the credential state.
  - On Android it shows `isSupported === false` and the `unsupported` rejection.
- XCTest covers `AppleSignInErrorToken.token(for:)` for 1000–1005 and for a
  non-ASAuthorization `NSError`.
- The harness suite asserts `isSupported` per platform and the Android `unsupported`
  rejections.
- The README covers all 10 items of SPEC §7 plus the troubleshooting notes from SPEC §3.

Key Discoveries:
- **Nitrogen output.** Stock nitrogen 0.37.1 generates this spec cleanly. This was verified in
  a scratch dir; see research Follow-up 2.
  - The Swift protocol is `func signIn(request: AppleAuthRequest) throws -> Promise<AppleAuthCredential>`
    and `func getCredentialState(user: String) throws -> Promise<AppleCredentialState>`.
  - `AppleAuthRequest` has `var scopes: [AppleAuthScope]?`.
  - The **exact Swift and Kotlin enum case names** for `'fullName'`, `'likelyReal'` and
    `'notFound'` must be read from the generated files, not guessed.
- **The HoloCatch patch.** Nitrogen emits `Func_void_std__exception_ptr.swift`
  (`RuntimeError.from(cppError:)`) for **every** `Promise` return. PK has the same file and
  compiles unpatched. The HoloCatch patch
  (`/Volumes/CaseSensitive/GitHub/holocatch/patches/nitrogen@0.37.1.patch`) is only the
  fallback if the generated Swift fails to compile.
- **Error transport** (Nitro 0.37.1):
  - A Swift `RuntimeError.error(withMessage:)` reaches JS as its message verbatim when it is
    an async rejection.
  - A sync throw gets a `"<Type>.<method>(...): "` prefix.
  - The token regex matches anywhere in the message.
- **PK reference code:**
  - `PK/ios/HybridNitroPasskeys.swift:10-60` is the lock and `active` guard, with
    `begin`/`clear`.
  - `:76-117` is the `@MainActor` request helper, with a `nonisolated init` and `start()`.
  - `:148-172` is `settle`, which runs once and releases the controller after the callback.
  - `:282-289` is `presentationWindow()`.
  - `PK/src/PasskeyError.ts` is the error-class shape to mirror.
- **Podfile.** `PK/example/ios/Podfile` nests `target 'NitroPasskeysExampleTests' do inherit! :search_paths end`.
  With `:complete`, the HybridObject registers twice and the app aborts. The `post_install`
  hook sets `ENABLE_TESTABILITY = YES` on the pod.
- **XCTest target settings.** PK's test target needs `SWIFT_OBJC_INTEROP_MODE = objcxx` and
  `HEADER_SEARCH_PATHS += "${PODS_ROOT}/Headers/Private/NitroModules"`. They come across with
  the copied `project.pbxproj`.
- **oxlint.** A bare `export {};` fails `oxlint --deny-warnings` without
  `// oxlint-disable-next-line unicorn/require-module-specifiers`. The `no-nodejs-modules`
  rule rejects `node:fs`; use Bun APIs instead.
- **TypeScript 7.0.2** rejects `baseUrl` (TS5102). PK's `example/tsconfig.json` already drops
  it.

### Decisions that override SPEC (from research follow-ups and outline review)

| Topic | Decision |
|---|---|
| Scaffold source | Copy from **PK** at `3084815`, not image-pipeline. SPEC §2 names image-pipeline, but PK is the verified superset with the exact SPEC versions. |
| Token regex | `/\[AppleSignIn:([A-Za-z0-9-]+)\]\s?/`. The trailing `\s?` is PK's form. `from()` falls back to the original text when stripping leaves an empty string. |
| Unlisted files | Add `android/.../NitroAppleSignInPackage.kt`, `.oxlint/react-native-plugin.mjs`, `scripts/hooks/swiftlint.sh`, `example/ios/NitroAppleSignInExample/SceneDelegate.swift`, `.github/dependabot.yml`, and `tsconfig.build.json` (bob's project, which excludes `__tests__`). |
| `cpp-adapter.cpp` | The `facebook::jni::initialize(vm, [] { margelo::nitro::nitroapplesignin::registerAllNatives(); })` form, as in PK. |
| `isSupported` short-circuit | None in JS. This is the SPEC's decision. Android rejects natively. |
| `package.json` `overrides` | Keep `{ "lodash-es": "4.17.21", "typescript": "$typescript" }`. |
| Example signing | Committed `example/ios/Config/{Debug,Release}.xcconfig` files `#include` the Pods xcconfig, then `#include?` a gitignored `Signing.local.xcconfig`. `bun run --cwd example signing` writes that file from the env vars `APPLE_TEAM_ID` and `APPLE_BUNDLE_ID`. With no local file, the defaults are `com.nitroapplesigninexample` with no team. CI keeps `CODE_SIGNING_ALLOWED=NO`. |
| Harness suite | Add a small suite, which SPEC §6 does not list. It checks `isSupported` per platform, and that both wrappers reject `unsupported` on Android. This closes research open question 6. |
| Android tests | No JUnit. The Kotlin class has no logic worth unit-testing. Drop PK's `testDebugUnitTest` CI step. |

## What We're NOT Doing

- No web or OAuth fallback on Android, and no Android dependency beyond RN and nitro-modules.
- No crypto: no nonce hashing and no JWT signature verification in the module or the example
  (the example decodes claims with `atob` only).
- No server code, and no `example/server` port from PK.
- No npm publish and no `semantic-release` run. `release.yml` is added but never triggered.
- No changes outside this repo: not `wc2018/apps/mobile`, not HoloCatch, not SPEC, not PK.
- No CI automation of a successful sign-in, because the OS sheet can't be driven. That stays
  manual.
- No `CLAUDE.md`, `post-script.ts`, `.zed/` or `docs/plans/`.
- No committed `DEVELOPMENT_TEAM` or personal bundle id anywhere in `project.pbxproj`.

## Implementation Approach

The phases run in this order:

1. **Scaffold.** Build a complete, buildable skeleton by copying PK. It includes the final
   Android class, which only rejects, and the example app's XCTest target, entitlement and
   signing setup. Every later phase verifies against this build.
2. **TypeScript layer.** It is pure and fully unit-testable, and it fixes the token contract
   that Swift emits.
3. **Swift implementation.** This is the only phase that needs deep reasoning: delegate
   lifetime, main thread, and once-only settlement.
4. **Example demo and harness suite.** These exercise everything end to end.
5. **README.**
6. **Doc drift sweep** (mandatory).

## Orchestration

**Orchestrator model:** `sonnet`. This is the balanced tier. The phases are tightly specified
and copy from a proven template. The orchestrator's job is to brief subagents, check diffs
against the plan, re-run verification, and settle toolchain drift in CocoaPods, Gradle and
xcconfig. This line is static.

**Commit convention:** one commit per phase, directly on `main`. The repo has no commits yet,
so Phase 1's commit is the root commit.
- Stage the phase's changes **plus** the updated `tasks/2026-09-26-nitro-apple-sign-in-v1/`
  files. Phase 1's commit includes `research.md` and this plan.
- Messages are Conventional Commits, because semantic-release parses them:
  - Phase 1: `chore: scaffold nitro module and example app (phase 1)`
  - Phase 2: `feat: typescript api and AppleSignInError (phase 2)`
  - Phase 3: `feat(ios): sign in with apple via AuthenticationServices (phase 3)`
  - Phase 4: `feat(example): sign-in demo and harness suite (phase 4)`
  - Phase 5: `docs: README (phase 5)`
  - Phase 6: `docs: fix doc drift (phase 6)`
- Each message ends with these two trailer lines:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01Kxhpa11KwbyRCHEugC1dCf`.
- Lefthook pre-commit hooks run; do not bypass them. Don't push.

---

## Phase 1: Scaffold library, codegen and example app

### Overview
Create the complete buildable skeleton by copying PK at `3084815` and applying the rename rule
(see Overview). It includes:
- the library config, tooling, CI and release config
- the HybridObject spec, copied exactly from SPEC
- the committed nitrogen output
- a Swift stub
- the **final** Android implementation
- the example app with its XCTest target, the Sign in with Apple entitlement and env-driven
  signing

The phase ends with both platforms building. It comes first because every later phase
verifies against this build.

### Recommended model
`sonnet`: mostly mechanical copy-and-rename, but it touches bun, nitrogen, CocoaPods, Xcode
project files and Gradle.

### Effort
high (briefing guidance). There are many files. Renaming an Xcode project and an Android
package directory fails in non-obvious ways, and the xcconfig/CocoaPods interplay has to be
exactly right.

### Changes Required

#### 1. Root tooling files (copied from PK, renamed)
**Files**: repo root
**Changes**:
- [x] Copy these files from PK at `3084815` without changes, then apply the rename rule:
  - `.gitignore`, `.oxfmtrc.json`, `.oxlintrc.json`, `.oxlint/react-native-plugin.mjs`
  - `.watchmanconfig`, `.swiftlint.yml`, `babel.config.js`, `bunfig.toml`
  - `lefthook.yml`, `release.config.cjs`, `LICENSE`
  - `scripts/hooks/swiftlint.sh`, `.github/dependabot.yml`
  - `tsconfig.json`, `tsconfig.build.json`

  **Don't** copy `scripts/add-ios-test-target.rb`.
- [x] In `tsconfig.json`, remove any `include` entry for `example/server/**/*`. Keep
  `"types": ["bun"]`.
- [x] Append `example/ios/Config/Signing.local.xcconfig` to `.gitignore`.
- [x] Create `CHANGELOG.md` containing only `# Changelog\n`.
- [x] Create `nitro.json` exactly as the SPEC §2 "`nitro.json`" block (autolinking key
  `NitroAppleSignIn`, with both implementation classes named `HybridNitroAppleSignIn`).

#### 2. `package.json`
**File**: `package.json`
**Changes**:
- [x] Create it from `PK/package.json` at `3084815` with these changes:
  - `name`, `description`, `version` and `scripts` exactly as the SPEC §2 `package.json` block
    (description: `"Sign in with Apple for React Native, built with Nitro Modules"`). This
    removes `example:server`.
  - `keywords`: `["react-native", "nitro", "apple", "sign-in-with-apple", "authentication", "react-native-nitro-apple-sign-in"]`
  - `repository`, `bugs` and `homepage`: PK's values with the rename rule applied
  - the `files` list exactly as SPEC, which matches PK's
  - `devDependencies`: exactly the SPEC list. This **drops `@simplewebauthn/server`**.
  - keep the `overrides` block
  - keep `react-native-builder-bob` with `tsconfig.build.json` as the typescript project
  - keep `trustedDependencies: ["lefthook"]`

#### 3. HybridObject spec and placeholder entry
**Files**: `src/specs/nitro-apple-sign-in.nitro.ts`, `src/index.ts`
**Changes**:
- [x] Create `src/specs/nitro-apple-sign-in.nitro.ts` exactly as the SPEC §3 code block
  (the one that starts `import type { HybridObject } …`). `oxfmt` may re-wrap whitespace;
  that's fine.
- [x] Create a placeholder `src/index.ts`. Phase 2 replaces it.
  ```ts
  // oxlint-disable-next-line unicorn/require-module-specifiers
  export {};
  ```

#### 4. iOS pod and stub
**Files**: `NitroAppleSignIn.podspec`, `ios/HybridNitroAppleSignIn.swift`
**Changes**:
- [x] Create `NitroAppleSignIn.podspec` from `PK/NitroPasskeys.podspec` by applying the
  rename rule. It keeps:
  - the `pod_version` prerelease strip and its comment
  - `s.platforms = { :ios => '16.0' }`
  - the source files `ios/**/*.{swift}` and `ios/**/*.{m,mm}`
  - `s.frameworks = 'AuthenticationServices'`
  - `load 'nitrogen/generated/ios/NitroAppleSignIn+autolinking.rb'` and `add_nitrogen_files(s)`
  - the `React-jsi` and `React-callinvoker` dependencies
  - `install_modules_dependencies(s)`
- [x] Don't create `ios/Bridge.h` unless the podspec or the build needs it. PK's is only
  `#pragma once`. If the build fails without it, add it with only `#pragma once` and record a
  `> Deviation:` note.
  > Deviation: not needed — the iOS build succeeded without `ios/Bridge.h`.
- [x] Create the stub `ios/HybridNitroAppleSignIn.swift`. Phase 3 replaces the bodies. Match
  the exact signatures in the generated
  `nitrogen/generated/ios/swift/HybridNitroAppleSignInSpec.swift`.
  ```swift
  import NitroModules

  final class HybridNitroAppleSignIn: HybridNitroAppleSignInSpec {
    var isSupported: Bool { true }

    func signIn(request: AppleAuthRequest) throws -> Promise<AppleAuthCredential> {
      Promise.rejected(withError: RuntimeError.error(withMessage: "[AppleSignIn:unknown] Not implemented"))
    }

    func getCredentialState(user: String) throws -> Promise<AppleCredentialState> {
      Promise.rejected(withError: RuntimeError.error(withMessage: "[AppleSignIn:unknown] Not implemented"))
    }
  }
  ```

#### 5. Android library and final implementation
**Files**: `android/**`
**Changes**:
- [x] Copy these from PK at `3084815` and apply the rename rule:
  - `android/fix-prefab.gradle`, `android/gradle.properties`, `android/CMakeLists.txt`
  - `android/src/main/AndroidManifest.xml`, `android/src/main/cpp/cpp-adapter.cpp`

  `gradle.properties` must use the `NitroAppleSignIn_` property prefix. `cpp-adapter.cpp`
  includes `"NitroAppleSignInOnLoad.hpp"` and calls
  `margelo::nitro::nitroapplesignin::registerAllNatives()`.
- [x] Create `android/build.gradle` from PK's with the rename rule applied, with two changes:
  - replace the `dependencies {}` block (PK `:137-146`) with:
    ```gradle
    dependencies {
      //noinspection GradleDynamicVersion
      implementation "com.facebook.react:react-native:+"
      implementation project(":react-native-nitro-modules")
    }
    ```
  - remove any JUnit or `testOptions` config
- [x] Look at the `minSdkVersion` line in `defaultConfig`. PK hard-codes `28` with a comment;
  this module has no minSdk requirement. Replace it with
  `minSdkVersion getExtOrIntegerDefault("minSdkVersion")`. In `gradle.properties`, set
  `NitroAppleSignIn_minSdkVersion=24`.
- [x] Create `android/src/main/java/com/margelo/nitro/nitroapplesignin/NitroAppleSignInPackage.kt`
  from PK's `NitroPasskeysPackage.kt` with the rename rule applied. It is a no-op
  `BaseReactPackage` with `companion object { init { NitroAppleSignInOnLoad.initializeNative() } }`.
- [x] Create the **final** `android/src/main/java/com/margelo/nitro/nitroapplesignin/HybridNitroAppleSignIn.kt`
  (SPEC §5).
  - Match the generated `nitrogen/generated/android/kotlin/com/margelo/nitro/nitroapplesignin/HybridNitroAppleSignInSpec.kt`
    exactly: the property and parameter types, and whether `isSupported` is a `val` with a
    getter.
  - Keep `@DoNotStrip`/`@Keep` only if PK's `HybridNitroPasskeys.kt` has them.
  > Deviation: PK's `HybridNitroPasskeys.kt` has neither annotation, so
  > `HybridNitroAppleSignIn.kt` was written without them (the illustrative snippet below shows
  > them; the actual file correctly omits them).
  ```kotlin
  package com.margelo.nitro.nitroapplesignin

  import androidx.annotation.Keep
  import com.facebook.proguard.annotations.DoNotStrip
  import com.margelo.nitro.core.Promise

  @DoNotStrip
  @Keep
  class HybridNitroAppleSignIn : HybridNitroAppleSignInSpec() {
    override val isSupported: Boolean
      get() = false

    override fun signIn(request: AppleAuthRequest): Promise<AppleAuthCredential> =
      Promise.rejected(Error(UNSUPPORTED))

    override fun getCredentialState(user: String): Promise<AppleCredentialState> =
      Promise.rejected(Error(UNSUPPORTED))

    private companion object {
      const val UNSUPPORTED = "[AppleSignIn:unsupported] Sign in with Apple is only available on iOS"
    }
  }
  ```
- [x] Don't create `android/src/test/`.

#### 6. Codegen
- [x] Run `bun install`, then `bun run codegen`, which runs nitrogen, then typecheck and
  `bob build`.
  - Commit all of `nitrogen/generated/` and `bun.lock`.
  - Never hand-edit generated files.
  - Before writing the stubs, read the generated Swift and Kotlin specs and enums, and match
    them.
- [x] If the generated Swift fails to compile because of the `RuntimeError.from(cppError:)`
  codegen:
  - copy `/Volumes/CaseSensitive/GitHub/holocatch/patches/nitrogen@0.37.1.patch` into
    `patches/`
  - add `"patchedDependencies": { "nitrogen@0.37.1": "patches/nitrogen@0.37.1.patch" }` to
    `package.json`
  - re-run `bun install` and `bun run codegen`
  - record a `> Deviation:` note
  > Deviation: not needed — the generated Swift (including `HybridNitroAppleSignInSpec.swift`)
  > compiled cleanly. This spec has no error-taking callbacks, so the `RuntimeError.from(cppError:)`
  > codegen path never runs, as SPEC's own note anticipated.

#### 7. Example app (copied from PK and renamed)
**Files**: `example/**`
**Changes**:
- [x] Extract PK's `example/` at `3084815`:
  `git -C /Volumes/CaseSensitive/GitHub/react-native-nitro-passkeys archive 3084815 example | tar -x -C .`
  - Then **delete**: `example/server/`, `example/src/`, `example/__tests__/passkeys.harness.ts`,
    `example/ios/Podfile.lock`, and every file in `example/ios/NitroPasskeysExampleTests/`.
  - Keep the directory; it's renamed below.
- [x] Rename the paths:
  - `example/ios/NitroPasskeysExample/` → `NitroAppleSignInExample/`
  - `NitroPasskeysExample.xcodeproj` → `NitroAppleSignInExample.xcodeproj`
  - `NitroPasskeysExample.xcworkspace` → `NitroAppleSignInExample.xcworkspace`
  - `NitroPasskeysExampleTests/` → `NitroAppleSignInExampleTests/`
  - the shared scheme `NitroPasskeysExample.xcscheme` → `NitroAppleSignInExample.xcscheme`
  - the entitlements file → `NitroAppleSignInExample.entitlements`
  - `example/android/app/src/main/java/com/nitropasskeysexample/` → `…/com/nitroapplesigninexample/`
- [x] Apply the rename rule to the **contents** of every remaining file under `example/`,
  including:
  - `project.pbxproj`, the `.xcscheme` and `contents.xcworkspacedata`
  - `Podfile`, `Info.plist`, `AppDelegate.swift`, `SceneDelegate.swift`
  - the Android Gradle files, the manifest and the Kotlin files
  - `app.json`, `package.json`, `rn-harness.config.mjs`, `tsconfig.json`, `babel.config.js`,
    `metro.config.js`, `react-native.config.js`, `index.js`
  - the `.harness/*` files

  Then run the rename-rule grep over `example/`, excluding binary files.
- [x] In `project.pbxproj`, delete both `PASSKEYS_RP_ID = …;` lines.
- [x] Remove every file reference to the deleted PK test files (`Base64URLTests.swift`,
  `EnumRawValueTests.swift`, `PasskeyErrorTokenTests.swift`) from the test target, and any
  reference to `example/src`.
  - Use the `xcodeproj` Ruby gem that ships with CocoaPods (`ruby -e 'require "xcodeproj"; …'`),
    not hand edits. Save with `project.save`.
  - The `NitroAppleSignInExampleTests` target and its build settings stay: host app,
    `TEST_HOST`/`BUNDLE_LOADER`, `SWIFT_OBJC_INTEROP_MODE = objcxx` and the NitroModules
    header search path.
  - Add one placeholder test file, `example/ios/NitroAppleSignInExampleTests/PlaceholderTests.swift`,
    to that target (Phase 3 replaces it):
    ```swift
    import XCTest

    final class PlaceholderTests: XCTestCase {
      func testPlaceholder() {
        XCTAssertTrue(true)
      }
    }
    ```
- [x] Replace the contents of `example/ios/NitroAppleSignInExample/NitroAppleSignInExample.entitlements`.
  `CODE_SIGN_ENTITLEMENTS` already points at it on the app target only.
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
  	<key>com.apple.developer.applesignin</key>
  	<array>
  		<string>Default</string>
  	</array>
  </dict>
  </plist>
  ```
- [x] Set up `example/package.json` from PK's with the rename rule applied (name
  `react-native-nitro-apple-sign-in-example`). Add the script
  `"signing": "bun scripts/write-signing.ts"`.
- [x] Replace `example/App.tsx` with a minimal placeholder that renders the text
  `NitroAppleSignIn example`. Phase 4 writes the real screen, and the placeholder must not
  import anything PK-specific.
- [x] Replace `example/README.md` with a two-line pointer to the root README (Phase 5 writes
  the README).
- [x] Remove `server` from `example/tsconfig.json`'s `exclude` if it is there. Keep
  `paths: {"react-native-nitro-apple-sign-in": ["../src"]}`, and add no `baseUrl`.

#### 8. Env-driven signing (example iOS)
**Files**: `example/ios/Config/Debug.xcconfig`, `example/ios/Config/Release.xcconfig`, `example/scripts/write-signing.ts`, `project.pbxproj`
**Changes**:
- [x] Create `example/ios/Config/Debug.xcconfig`. Include paths are relative to the xcconfig
  file.
  ```
  // Pods settings first, then committed defaults, then the optional gitignored local override
  // written by `bun run --cwd example signing` (APPLE_TEAM_ID / APPLE_BUNDLE_ID).
  #include "../Pods/Target Support Files/Pods-NitroAppleSignInExample/Pods-NitroAppleSignInExample.debug.xcconfig"
  PRODUCT_BUNDLE_IDENTIFIER = com.nitroapplesigninexample
  #include? "Signing.local.xcconfig"
  ```
- [x] Create `Release.xcconfig` the same way, including `….release.xcconfig`.
- [x] Use the `xcodeproj` gem to set the **app target's** Debug and Release
  `baseConfigurationReference` to these files, added to a `Config` group. **Remove**
  `PRODUCT_BUNDLE_IDENTIFIER` from the app target's Debug and Release build settings in
  `project.pbxproj`, because a target-level setting would override the xcconfig.
  - Leave the test target's `baseConfigurationReference` (its Pods xcconfig) and its bundle
    id `com.nitroapplesigninexample.tests` alone.
  - Confirm that `DEVELOPMENT_TEAM` appears nowhere in `project.pbxproj`.
- [x] Create `example/scripts/write-signing.ts`, a bun script that uses no Node built-ins:
  - read `Bun.env.APPLE_TEAM_ID` and `Bun.env.APPLE_BUNDLE_ID`
  - if either is missing, print usage and `process.exit(1)`
  - if `APPLE_TEAM_ID` doesn't match `/^[A-Z0-9]{10}$/`, print an error and exit 1
  - write `ios/Config/Signing.local.xcconfig`, resolved from `import.meta.dir`:
    ```
    // Generated by `bun run --cwd example signing`. Gitignored.
    DEVELOPMENT_TEAM = <APPLE_TEAM_ID>
    PRODUCT_BUNDLE_IDENTIFIER = <APPLE_BUNDLE_ID>
    CODE_SIGN_STYLE = Automatic
    ```
  - print the path it wrote
- [x] Run `bun install` at the root, then `bun run --cwd example pod`. CocoaPods may warn that
  the base configuration is custom. That is expected, because the xcconfig includes the Pods
  one. Commit `example/ios/Podfile.lock`.
- [x] Verify the resolved bundle id with
  `xcodebuild -workspace example/ios/NitroAppleSignInExample.xcworkspace -scheme NitroAppleSignInExample -showBuildSettings -configuration Debug | grep PRODUCT_BUNDLE_IDENTIFIER`.
  It should show `com.nitroapplesigninexample` for the app when no local file exists.

#### 9. CI workflows
**Files**: `.github/workflows/{static-checks,release,ios,android}.yml`
**Changes**:
- [x] Copy all four from PK at `3084815` and apply the rename rule.
  - `static-checks.yml` keeps its `Test (bun)` step (`bun test src`).
  - `ios.yml` keeps the build step, the `Unit tests (XCTest)` step (both with
    `CODE_SIGNING_ALLOWED=NO`) and the harness steps. Phase 4 adds the suite they run.
  - `android.yml`: **delete** the `Unit tests (JUnit)` step (`testDebugUnitTest`). Keep the
    build and harness steps.
- [x] Remove any path filter or step that references `example/server` or fixtures.
  > Deviation: also fixed a stale header comment in `.github/workflows/android.yml` that still
  > described running the module's JUnit tests, left over after the `Unit tests (JUnit)` step
  > was removed.

### Success Criteria

#### Automated Verification:
- [x] Install: `bun install`
- [x] Build (typecheck + bob): `bun run build`
- [x] Lint: `bunx oxlint --deny-warnings`
- [x] Format: `bunx oxfmt --check`
- [x] The committed nitrogen output is current: `bunx nitrogen --logLevel="debug"`, then
  `git status --porcelain nitrogen/` prints nothing new
- [x] Nothing is left over from the rename:
  `grep -rniIE 'passkey|webauthn|simplewebauthn|PASSKEYS_RP_ID|SERVER_URL' --exclude-dir=node_modules --exclude-dir=Pods --exclude-dir=build --exclude-dir=tasks --exclude-dir=nitrogen --exclude=bun.lock .`
  prints nothing
- [x] Pods: `bun run --cwd example pod`
- [x] iOS build: `xcodebuild -workspace example/ios/NitroAppleSignInExample.xcworkspace -scheme NitroAppleSignInExample -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' build CODE_SIGNING_ALLOWED=NO`
- [x] XCTest target links and runs: `xcodebuild test -workspace example/ios/NitroAppleSignInExample.xcworkspace -scheme NitroAppleSignInExample -destination 'platform=iOS Simulator,name=iPhone 17' CODE_SIGNING_ALLOWED=NO`
- [x] Android build: `example/android/gradlew -p example/android assembleDebug`
- [x] Swift lint: `scripts/hooks/swiftlint.sh`
- [x] The signing script rejects missing env: `bun run --cwd example signing` exits non-zero

#### Manual Verification:
- [ ] `bun run --cwd example ios` launches on the iPhone 17 simulator, and the placeholder
  renders through `SceneDelegate`
- [ ] `bun run --cwd example android` launches on an emulator
- [ ] `env APPLE_TEAM_ID=<team> APPLE_BUNDLE_ID=<id> bun run --cwd example signing` writes the
  local xcconfig, Xcode shows that team and bundle id on the app target, and `git status` stays
  clean

---

## Phase 2: TypeScript layer and bun tests

### Overview
Implement the JS surface from SPEC §3: `AppleSignInError` with its token parser, and the
public entry with the two typed wrappers. Add both bun test files from SPEC §6. This comes
before the Swift phase because it fixes the token contract that native code emits.

### Recommended model
`sonnet`: well-specified pure TypeScript with a complete mapping table to transcribe and test.

### Effort
medium (briefing guidance). The logic is small, but the test matrix must cover every row
of the SPEC §3 table.

### Depends on prior phases
- `package.json` has the scripts `test: bun test src`, `typecheck: tsc --noEmit` and
  `build: bun run typecheck && bob build`. `tsconfig.json` includes `"types": ["bun"]`.
- `tsconfig.build.json` excludes `src/**/__tests__` and is bob's typescript project.
- `src/specs/nitro-apple-sign-in.nitro.ts` exports the types `AppleAuthScope`,
  `AppleAuthRequest`, `AppleAuthFullName`, `AppleRealUserStatus`, `AppleAuthCredential`,
  `AppleCredentialState` and the interface `NitroAppleSignIn` (with `isSupported`, `signIn`
  and `getCredentialState`).
- `src/index.ts` is a placeholder (`export {};` with an oxlint disable comment).
- `.github/workflows/static-checks.yml` already runs `bun test src`.

### Changes Required

#### 1. Error class
**File**: `src/AppleSignInError.ts`
**Changes**:
- [x] Implement it with PK's `src/PasskeyError.ts` (at `3084815`) as the structural template:
  ```ts
  export type AppleSignInErrorCode =
    | 'canceled'
    | 'failed'
    | 'invalidResponse'
    | 'notHandled'
    | 'unsupported'
    | 'unknown';

  const TOKEN_RE = /\[AppleSignIn:([A-Za-z0-9-]+)\]\s?/;
  const ASAUTH_RE = /^asauth-\d+$/;
  const NAMED: ReadonlySet<string> = new Set<AppleSignInErrorCode>(['invalidResponse', 'unsupported', 'unknown']);
  const ASAUTH: Readonly<Record<string, AppleSignInErrorCode>> = {
    'asauth-1000': 'unknown',
    'asauth-1001': 'canceled',
    'asauth-1002': 'invalidResponse',
    'asauth-1003': 'notHandled',
    'asauth-1004': 'failed',
    'asauth-1005': 'unknown',
  };

  function codeForToken(token: string | undefined): AppleSignInErrorCode { /* see rules */ }

  export class AppleSignInError extends Error {
    readonly code: AppleSignInErrorCode;
    constructor(code: AppleSignInErrorCode, message: string) {
      super(message);
      this.name = 'AppleSignInError';
      this.code = code;
    }
    /** Normalises anything thrown by `AppleSignIn.signIn` / `getCredentialState`. Never throws. Used by the typed wrappers. */
    static from(error: unknown): AppleSignInError { /* see rules */ }
  }
  ```
  `codeForToken` rules:
  - `undefined` → `unknown`
  - a key of `ASAUTH` → its value
  - any other `asauth-<n>` → `unknown`
  - a token in `NAMED` → itself
  - anything else → `unknown`

  Only `invalidResponse`, `unsupported` and `unknown` are legitimate named tokens (SPEC §3).
  `canceled`, `failed` and `notHandled` only arrive via `asauth-N`, so a named `[AppleSignIn:canceled]`
  maps to `unknown`. **If you judge otherwise, don't silently widen it**: keep `NAMED` as is and
  record a `> Deviation:` note.

  `from()` rules:
  - an `AppleSignInError` is returned as the **same instance**
  - `original` is `error.message` for an `Error`, the value itself for a string, and
    `'Unknown error'` otherwise
  - the resulting message is `original` with the first `TOKEN_RE` match removed. Keep any Nitro
    `"NitroAppleSignIn.signIn(...): "` prefix. If the result is empty, use `original`.
  - wrap the whole body in `try/catch`, returning `new AppleSignInError('unknown', 'Unknown error')`

#### 2. Public entry
**File**: `src/index.ts` (replace the placeholder)
**Changes**:
- [x] Implement it exactly as the SPEC §3 "JS entry: `src/index.ts`" block. Note that this
  means:
  - `AppleSignIn` **is** exported, unlike PK's `native`
  - `request` defaults to `{}`
  - there is no `isSupported` short-circuit and no validation
  - both wrappers are `async`, so a synchronous throw from the Nitro call becomes a rejection

#### 3. Bun tests
**Files**: `src/__tests__/AppleSignInError.test.ts`, `src/__tests__/wrappers.test.ts`
**Changes**:
- [x] `AppleSignInError.test.ts` (`import { describe, expect, test } from 'bun:test'`) covers
  SPEC §6:
  - `asauth-1000` → `unknown`, `1001` → `canceled`, `1002` → `invalidResponse`,
    `1003` → `notHandled`, `1004` → `failed` and `1005` → `unknown`
  - `asauth-1006` and `asauth-1099` → `unknown`
  - the named tokens `invalidResponse`, `unsupported` and `unknown` map to themselves
  - an unknown named token (`bogus`) → `unknown`
  - `"NitroAppleSignIn.signIn(...): [AppleSignIn:asauth-1001] The operation couldn't be completed."`
    → `canceled`, with the message `"NitroAppleSignIn.signIn(...): The operation couldn't be completed."`
  - an fbjni-style message, `"java.lang.Error: [AppleSignIn:unsupported] Sign in with Apple is only available on iOS"`
    → `unsupported`
  - the marker stripped: `"[AppleSignIn:asauth-1001] Canceled"` → message `"Canceled"`, with
    no leading space
  - a marker-only message, `"[AppleSignIn:unknown]"` → message falls back to the original text
  - no token → `unknown`, keeping the message exactly
  - `undefined` → `unknown` / `'Unknown error'`; a string → `unknown` with that string as the
    message; `42` → `unknown`
  - an existing `AppleSignInError` → `toBe` the same instance
  - `name === 'AppleSignInError'`, and `instanceof Error`
- [x] `wrappers.test.ts` follows the PK `src/__tests__/index.test.ts:1-14` pattern:
  - `fake = { isSupported: true, signIn: mock(), getCredentialState: mock() }`
  - `mock.module('react-native-nitro-modules', () => ({ NitroModules: { createHybridObject: () => fake } }))`
    runs **before** `const mod = await import('../index')`
  - reset the mocks in `beforeEach`

  Cases:
  - `signInWithApple`:
    - it resolves with exactly (`toBe`) the credential `fake.signIn` resolves with, and passes
      the request object through (`toHaveBeenCalledWith(request)`)
    - with no argument, `fake.signIn` receives `{}`
    - a rejection with the Nitro-prefixed `asauth-1001` message gives `instanceof mod.AppleSignInError`,
      `code === 'canceled'`, and a message without the marker
    - a rejection with no token gives `unknown`, keeping the message
    - `fake.signIn` throwing **synchronously** (`mockImplementation(() => { throw new Error('[AppleSignIn:invalidResponse] bad') })`)
      gives a rejected promise with `code === 'invalidResponse'`
  - `getAppleCredentialState`:
    - it resolves with the state from `fake.getCredentialState` and passes `user` through
    - a rejection `"[AppleSignIn:unsupported] Sign in with Apple is only available on iOS"`
      gives `code === 'unsupported'`
  - `mod.AppleSignIn` is the fake: `toBe(fake)`

### Success Criteria

#### Automated Verification:
- [x] Tests: `bun test src`
- [x] Typecheck: `bun run typecheck`
- [x] Build: `bun run build`, and `ls lib/typescript/src` shows no `__tests__`
- [x] Lint: `bunx oxlint --deny-warnings`
- [x] Format: `bunx oxfmt --check`

#### Manual Verification:
- [ ] `src/index.ts` matches the SPEC §3 block, including the exported names and the doc
  comments

---

## Phase 3: iOS native implementation and XCTest

### Overview
Replace the Swift stub with the real `AuthenticationServices` implementation (SPEC §4). Add
the pure `AppleSignInErrorToken` mapper and its XCTest, and delete the XCTest placeholder.

### Recommended model
`opus`: this phase needs careful reasoning about:
- the lifetime of a weakly-held delegate
- main-actor isolation of the AuthenticationServices protocols in the iOS 27 SDK
- once-only promise settlement across threads
- mapping to Nitro-generated Swift structs and enums

### Effort
high (briefing guidance). A promise that never settles means a hung sign-in. A double settle
can crash. A wrong nonce or state mapping silently breaks server verification.

### Depends on prior phases
- `nitrogen/generated/ios/swift/HybridNitroAppleSignInSpec.swift` declares `var isSupported: Bool { get }`,
  `func signIn(request: AppleAuthRequest) throws -> Promise<AppleAuthCredential>` and
  `func getCredentialState(user: String) throws -> Promise<AppleCredentialState>`.
  - Generated Swift types `AppleAuthRequest` (`scopes: [AppleAuthScope]?`, `nonce: String?`,
    `state: String?`), `AppleAuthCredential`, `AppleAuthFullName`, and the enums
    `AppleAuthScope`, `AppleRealUserStatus` and `AppleCredentialState` exist under
    `nitrogen/generated/ios/swift/`.
  - **Read them for the exact initializer labels and enum case names.**
- `ios/HybridNitroAppleSignIn.swift` is a stub that rejects with `[AppleSignIn:unknown] Not implemented`.
- `NitroAppleSignIn.podspec` has `s.platforms = { :ios => '16.0' }`,
  `s.frameworks = 'AuthenticationServices'` and the source glob `ios/**/*.{swift}`.
- The example workspace `example/ios/NitroAppleSignInExample.xcworkspace` has the scheme
  `NitroAppleSignInExample`, whose test action includes the `NitroAppleSignInExampleTests`
  unit-test target.
  - That target is app-hosted, with Podfile `inherit! :search_paths`, and the pod is built with
    `ENABLE_TESTABILITY = YES` in Debug.
  - It currently holds only `PlaceholderTests.swift`.
- JS token mapping (`src/AppleSignInError.ts`): `asauth-1000..1005` → `unknown`/`canceled`/`invalidResponse`/`notHandled`/`failed`/`unknown`,
  any other `asauth-<n>` → `unknown`, and the named tokens `invalidResponse`, `unsupported`
  and `unknown`.

### Changes Required

#### 1. Error token mapper
**File**: `ios/AppleSignInErrorToken.swift`
**Changes**:
- [ ] Add the pure mapper, which has no UI:
  ```swift
  import AuthenticationServices
  import Foundation

  /// Maps native errors to the `[AppleSignIn:<token>]` tokens that `AppleSignInError.from` parses in JS.
  enum AppleSignInErrorToken {
    static func token(for error: Error) -> String {
      let nsError = error as NSError
      guard nsError.domain == ASAuthorizationError.errorDomain else { return "unknown" }
      return "asauth-\(nsError.code)"
    }

    static func message(token: String, _ text: String) -> String {
      "[AppleSignIn:\(token)] \(text)"
    }
  }
  ```

#### 2. Hybrid object
**File**: `ios/HybridNitroAppleSignIn.swift` (replace the stub)
**Changes**:
- [ ] Mirror `PK/ios/HybridNitroPasskeys.swift` at `3084815` for its structure:
  - the lock and `active` guard with `begin`/`clear` (`:10-60`)
  - the `@MainActor` helper with a `nonisolated init` (`:76-117`)
  - once-only `settle`, which releases the controller after the callback returns (`:148-172`)
  - `presentationWindow()` (`:282-289`)

  The class is `final class HybridNitroAppleSignIn: HybridNitroAppleSignInSpec, @unchecked Sendable`.
  Document that `active` is only touched under `lock`.
- [ ] `var isSupported: Bool { true }`
- [ ] **`signIn(request:)`**, per SPEC §4 steps 1–10:
  1. **In-flight guard.** Take the lock. If `active != nil`, return
     `.rejected(withError: appleSignInError("unknown", "A sign-in request is already in progress"))`
     without cancelling the first request.
  2. Otherwise, create `let promise = Promise<AppleAuthCredential>()` and the helper, store the
     helper in `active` (this also retains it, because the controller's delegate is weak),
     dispatch `DispatchQueue.main.async { helper.start() }` and return `promise`.
     - Capture only `Sendable` values across the hop: convert `request` into a small
       `Sendable` struct of `scopes: [ASAuthorization.Scope]`, `nonce: String?` and
       `state: String?` on the calling thread.
  3. Scopes: map `.email` → `.email` and `.fullName` → `.fullName` (use the generated enum's
     real case names). Drop duplicates while keeping first-seen order. A `nil` or empty list
     gives `[]`.
  4. Inside `start()`, on main:
     - resolve the window first. If there is none, settle with
       `appleSignInError("unknown", "No window to present on")`.
     - `let request = ASAuthorizationAppleIDProvider().createRequest()`
     - `request.requestedScopes = scopes`
     - `request.nonce = nonce` and `request.state = state`, **verbatim**, with no hashing or
       trimming
     - `ASAuthorizationController(authorizationRequests: [request])`
     - delegate and `presentationContextProvider` are the helper
     - store the controller, then call `performRequests()`
  5. `presentationAnchor(for:)` returns the stored window. The window lookup is PK's
     `presentationWindow()`: the foreground-active scene's `keyWindow`, else the first window
     of any connected `UIWindowScene`.
  6. `didCompleteWithAuthorization`: cast `authorization.credential` to
     `ASAuthorizationAppleIDCredential`. On failure, reject with
     `invalidResponse` / `"Unexpected credential type"`. Then build `AppleAuthCredential`:
     - `user` ← `credential.user`
     - `identityToken` ← `credential.identityToken.flatMap { String(data: $0, encoding: .utf8) }`.
       If it is `nil`, reject with `invalidResponse` / `"Missing or non-UTF-8 identity token"`.
     - `authorizationCode`: the same decode. If it is `nil`, reject with `invalidResponse` /
       `"Missing or non-UTF-8 authorization code"`.
     - `email` ← `credential.email`
     - `fullName`: first map each of `givenName` and `familyName` to `nil` when it is `nil` or
       empty. If **both** are then `nil`, or `credential.fullName` is `nil`, the result is
       `nil`. Otherwise it is `AppleAuthFullName(givenName:familyName:)`.
     - `realUserStatus`: `.unsupported`, `.unknown` and `.likelyReal` map to the generated
       enum's cases, and `@unknown default` maps to its `unknown` case
     - `state` ← `credential.state`
  7. `didCompleteWithError`: reject with
     `appleSignInError(AppleSignInErrorToken.token(for: error), error.localizedDescription)`.
  8. `settle` clears `active` via the `onSettle` closure **before** it resolves or rejects, so
     a follow-up call made from the JS continuation isn't rejected as in-progress. It runs at
     most once.
- [ ] **`getCredentialState(user:)`**:
  - no lock, and no main-thread hop (SPEC §4: no UI, may run alongside `signIn`)
  - `let promise = Promise<AppleCredentialState>()`
  - `ASAuthorizationAppleIDProvider().getCredentialState(forUserID: user) { state, error in … }`
    - if `error` is set, reject with `appleSignInError(AppleSignInErrorToken.token(for: error), error.localizedDescription)`
    - otherwise map `.authorized`, `.revoked`, `.notFound` and `.transferred` to the generated
      cases, and `@unknown default` to the `notFound` case
  - return `promise`
- [ ] Add a private helper:
  `private func appleSignInError(_ token: String, _ text: String) -> Error { RuntimeError.error(withMessage: AppleSignInErrorToken.message(token: token, text)) }`
- [ ] The file must pass `scripts/hooks/swiftlint.sh` (the repo's `.swiftlint.yml`). If
  SwiftLint forces a structural change, such as un-nesting types, make it and record a
  `> Deviation:` note.

#### 3. XCTest
**Files**: `example/ios/NitroAppleSignInExampleTests/AppleSignInErrorTokenTests.swift`, `PlaceholderTests.swift`
**Changes**:
- [ ] Add `AppleSignInErrorTokenTests.swift`, using `@testable import NitroAppleSignIn`,
  `import AuthenticationServices` and `import XCTest`:
  - for n in 1000…1005, `NSError(domain: ASAuthorizationError.errorDomain, code: n)` gives
    `"asauth-\(n)"`
  - `ASAuthorizationError(.canceled)` (the typed error) gives `"asauth-1001"`
  - code 1099 in the AS domain gives `"asauth-1099"`
  - `NSError(domain: NSURLErrorDomain, code: -1)` gives `"unknown"`
  - `message(token: "asauth-1001", "x")` equals `"[AppleSignIn:asauth-1001] x"`
- [ ] Register the new file in the `NitroAppleSignInExampleTests` target with the `xcodeproj`
  gem. Remove `PlaceholderTests.swift` from the target and from disk.
- [ ] Run `bun run --cwd example pod`.

### Success Criteria

#### Automated Verification:
- [ ] Pods: `bun run --cwd example pod`
- [ ] iOS build: `xcodebuild -workspace example/ios/NitroAppleSignInExample.xcworkspace -scheme NitroAppleSignInExample -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' build CODE_SIGNING_ALLOWED=NO`
- [ ] XCTest: `xcodebuild test -workspace example/ios/NitroAppleSignInExample.xcworkspace -scheme NitroAppleSignInExample -destination 'platform=iOS Simulator,name=iPhone 17' CODE_SIGNING_ALLOWED=NO`
- [ ] Swift lint: `scripts/hooks/swiftlint.sh`
- [ ] The JS layer is unaffected: `bun test src`

#### Manual Verification:
- [ ] Reading the code confirms:
  - the in-flight guard rejects a second `signIn` without cancelling the first
  - every exit path (no window, success, each `invalidResponse`, the delegate error) clears
    `active` exactly once
  - `nonce` and `state` are passed through untouched

---

## Phase 4: Example app demo and harness suite

### Overview
Write the example screen from SPEC §6 and a small device harness suite. The suite asserts
`isSupported` per platform and the Android `unsupported` rejections, which confirms Android
JNI error transport end to end. This comes after the iOS phase so that the demo runs against
the real implementation.

### Recommended model
`sonnet`: straightforward React Native UI and harness tests against a finished API.

### Effort
medium (briefing guidance). It's standard UI work. The only subtleties are the base64url JWT
payload decoding, and keeping harness tests free of system sheets.

### Depends on prior phases
- `src/index.ts` exports `AppleSignIn` (with `isSupported`), `signInWithApple(request?)`,
  `getAppleCredentialState(user)`, `AppleSignInError` (with `.code`) and the types
  `AppleAuthCredential`, `AppleCredentialState` and `AppleSignInErrorCode`.
- The example resolves `react-native-nitro-apple-sign-in` to `../src` (`babel.config.js`
  module-resolver, and `tsconfig.json` `paths`). `example/App.tsx` is a placeholder.
- `example/rn-harness.config.mjs` has runners `iphone-17`
  (`process.env.HARNESS_IOS_VERSION ?? '26.4'`) and `medium_phone_api_36.1`, and bundle id
  `com.nitroapplesigninexample`.
  - `example/package.json` has the scripts `test:harness:ios`, `test:harness:android`, `ios`,
    `android`, `pod` and `signing`.
  - `example/jest.harness.config.mjs` and `example/.harness/setup.ts` exist.
- `example/__tests__/` contains no harness suite.
- `.github/workflows/ios.yml` and `android.yml` contain harness steps that run from
  `projectRoot: example`.
- iOS signing comes from `example/ios/Config/Signing.local.xcconfig`, which is gitignored and
  written by `bun run --cwd example signing` with `APPLE_TEAM_ID` and `APPLE_BUNDLE_ID`.

### Changes Required

#### 1. Demo screen
**File**: `example/App.tsx` (replace the placeholder; use PK's `App.tsx` at `3084815` only as a style reference for layout and `SafeAreaView`)
**Changes**:
- [ ] Show `Platform.OS` and `AppleSignIn.isSupported`.
- [ ] Add a **"Sign in with Apple"** button that:
  - generates a random `nonce` and `state`: 16 bytes from `crypto.getRandomValues` if it is
    available in Hermes, otherwise `Math.random`-based hex. It's a demo; note that in a comment.
  - calls `signInWithApple({ scopes: ['email', 'fullName'], nonce, state })`
  - stores `credential.user` for the state button
- [ ] Render the result:
  - the credential as pretty JSON, with `identityToken` and `authorizationCode` truncated for
    display
  - `state matches: yes/no` (`credential.state === state`)
  - the **decoded identity-token claims** `iss`, `aud`, `sub`, `nonce`, `email`,
    `email_verified`, `is_private_email`, `exp` and `iat`, taken from
    `JSON.parse(atob(base64urlToBase64(payload)))`
    - `payload` is the JWT's second segment
    - `base64urlToBase64` maps `-`→`+` and `_`→`/` and re-pads with `=`
    - there is no signature check; say so in a visible caption
  - `nonce matches: yes/no`
- [ ] Add a **"Credential state"** button, disabled until a `user` exists, that calls
  `getAppleCredentialState(user)` and shows the state.
- [ ] Every failure shows `` `${e.code}: ${e.message}` `` for an `AppleSignInError`, and
  `'non-AppleSignInError'` otherwise.
- [ ] On Android, the buttons stay enabled so that the `unsupported` rejection is visible
  (SPEC §6). Its "Credential state" button calls `getAppleCredentialState('android-test')`,
  because it can't have a user.

#### 2. Harness suite
**File**: `example/__tests__/apple-sign-in.harness.ts`
**Changes**:
- [ ] Use `describe`/`it`/`expect` from `react-native-harness`, and borrow the
  `rejection()`/`withTimeout()` helpers from PK's `example/__tests__/passkeys.harness.ts` at
  `3084815`. Cases:
  - the module loads, and `AppleSignIn.isSupported === (Platform.OS === 'ios')`
  - Android only (`if (Platform.OS === 'android')` around the `it` blocks, or `it.skip`
    equivalents on iOS):
    - `signInWithApple()` rejects with `instanceof AppleSignInError` and `code === 'unsupported'`
    - `getAppleCredentialState('x')` rejects the same way
  - **No iOS `signInWithApple` call.** It opens a system sheet or depends on the simulator's
    Apple Account state.
- [ ] Run each suite locally. If a case shows a system sheet, times out or is flaky, delete it
  and record a `> Deviation:` note. Don't commit a flaky test.

#### 3. Example docs
**File**: `example/README.md`
**Changes**:
- [ ] Replace the pointer with a short guide:
  - prerequisites: an App ID with Sign in with Apple enabled, and a device or simulator signed
    in to an Apple Account
  - `env APPLE_TEAM_ID=… APPLE_BUNDLE_ID=… bun run signing`, then `bun run pod`, then
    `bun run ios`
  - that the local xcconfig is gitignored
  - the harness commands

### Success Criteria

#### Automated Verification:
- [ ] Typecheck (the root `tsconfig` doesn't cover `example/`): `bunx tsc --noEmit -p example/tsconfig.json`
- [ ] Lint: `bunx oxlint --deny-warnings`
- [ ] Format: `bunx oxfmt --check`
- [ ] iOS build: `xcodebuild -workspace example/ios/NitroAppleSignInExample.xcworkspace -scheme NitroAppleSignInExample -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' build CODE_SIGNING_ALLOWED=NO`
- [ ] Android build: `example/android/gradlew -p example/android assembleDebug`
- [ ] iOS harness (install the app on the simulator first via `bun run --cwd example ios`): `env HARNESS_IOS_VERSION=27.0 bun run --cwd example test:harness:ios`
- [ ] Android harness (emulator `Medium_Phone_API_36.1` running with the app installed): `bun run --cwd example test:harness:android`

  If that AVD is unavailable, use another API 36 AVD, record a `> Deviation:` note, and leave
  the committed config unchanged.

#### Manual Verification:
- [ ] Run on iOS with a real team and bundle id (signing script), signed in to an Apple
  Account:
  - the sheet appears, and sign-in succeeds
  - `state` and `nonce` match
  - `aud` equals the bundle id
  - `email` and `fullName` appear on the first authorization only
- [ ] Dismissing the sheet shows `canceled: …`.
- [ ] "Credential state" shows `authorized` after sign-in. After removing the app under
  Settings → Apple Account → Sign in with Apple, it shows `revoked` or `notFound`.
- [ ] A build without the entitlement, or a simulator without an Apple Account, shows
  `unknown` (asauth-1000).
- [ ] Android shows `isSupported: false`, and both buttons show `unsupported: …`.

---

## Phase 5: README

### Overview
Write the root README to SPEC §7's 10 required items, plus the SPEC §3 troubleshooting notes
and a Development section. This comes after the implementation, so it documents what was
actually built.

### Recommended model
`sonnet`: technical writing against a detailed checklist.

### Effort
medium (briefing guidance). The security guidance (nonce, audience, server verification,
revocation) must be precise, because hosts will copy it.

### Depends on prior phases
- The public API in `src/index.ts`:
  - `signInWithApple(request?)` and `getAppleCredentialState(user)`, which reject only with
    `AppleSignInError`
  - the raw `AppleSignIn` singleton (`isSupported`, `signIn`, `getCredentialState`)
  - `AppleSignInError` with the codes `canceled | failed | invalidResponse | notHandled | unsupported | unknown`
    and `static from()`
  - the spec types
- iOS: a second concurrent `signIn` rejects `unknown` with "A sign-in request is already in
  progress". `nonce` and `state` are passed through verbatim. `fullName` is `undefined` when
  both parts are empty.
- Android: `isSupported` is `false`, and both methods reject with `unsupported`.
- The example signing flow is `bun run --cwd example signing` with `APPLE_TEAM_ID` and
  `APPLE_BUNDLE_ID`.
- The real dev commands:
  - `bun test src`, `bun run typecheck`, `bun run build`, `bun run codegen`
  - the XCTest `xcodebuild test … CODE_SIGNING_ALLOWED=NO` command
  - `bun run --cwd example test:harness:ios` / `test:harness:android` (with
    `HARNESS_IOS_VERSION`)
- The run's `> Deviation:` notes (in the briefing) override any of the above.

### Changes Required

#### 1. README
**File**: `README.md`
**Changes**:
- [ ] Add a title, a one-paragraph purpose statement (SPEC §1: iOS-native only, no crypto and
  no server work), and a requirements line: iOS 16+, RN 0.87 bare,
  `react-native-nitro-modules >=0.37.1 <0.38.0`.
- [ ] Cover SPEC §7 items 1–10 in order, each as its own section, with the exact content SPEC
  §7 lists:
  1. install
  2. entitlement
  3. nonce
  4. audience
  5. server verification with the `jose` snippet
  6. first authorization only
  7. authorization code and revocation (Guideline 5.1.1(v))
  8. credential state on launch
  9. Android
  10. usage and errors, with the `canceled` idiom snippet
- [ ] Include an error-code table built from the SPEC §3 mapping table (native source →
  `code`), plus the in-flight rejection.
- [ ] Add a Troubleshooting section with the SPEC §3 notes: a missing entitlement → `unknown`
  (1000), no Apple Account → `unknown` (1000), and a dismissed sheet → `canceled`.
- [ ] Add an API reference listing every export with its signature.
- [ ] Add a "Development" section with the real commands from "Depends on prior phases", and
  the example signing steps.
- [ ] Note that `nitrogen/generated/` is committed, and that `bun run codegen` regenerates it.

### Success Criteria

#### Automated Verification:
- [ ] Format: `bunx oxfmt --check` (it may ignore Markdown; if so, say so)

#### Manual Verification:
- [ ] Every SPEC §7 item is present and accurate, and every command in the README runs as
  written

---

## Final Phase (Phase 6): Doc Drift Check

### Overview
After all feature phases are complete, reconcile the documentation with what was actually
built.
- Diff the whole run: `git diff 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD` covers the
  whole repo, because planning started with no commits.
- Update every doc statement that the diff or the run's deviation notes invalidated, and only
  those. This is not a general doc cleanup.
- Leave the plan and research files alone; they are a historical record.

### Recommended model
`sonnet`

### Effort
medium

### Depends on prior phases
- All feature phases are complete. The briefing carries:
  - the diff base `4b825dc642cb6eb9a060e54bf8d69288fbee4904` (the empty tree), because this
    plan has no commit hash
  - the run's accumulated `> Deviation:` and `> Fix-up:` notes, for example a nitrogen patch,
    a dropped harness case, a `Bridge.h`, or a SwiftLint-driven restructure

  Check docs against what was *actually* built.

### Changes Required

#### 1. Documentation sweep
**Files**: `README.md`, `example/README.md`, `.github/workflows/*.yml` header comments, `package.json` `description`/`keywords`, doc comments in `src/index.ts`, `src/AppleSignInError.ts`, `ios/*.swift`, `android/**/*.kt`, and the comments in `example/ios/Config/*.xcconfig` and `example/scripts/write-signing.ts`
**Changes**:
- [ ] Check every `README.md` statement against the deviation notes: the error table, the
  harness coverage, the commands, the nitrogen patch (if one was applied) and the signing flow.
- [ ] Check `example/README.md` against the actual scripts and env var names.
- [ ] Check the CI workflow header comments for text left over from PK (JUnit, the server,
  fixtures, passkeys wording).
- [ ] Sweep the run's full diff for other stale docs, such as comments that describe changed
  behavior or leftover PK wording. Update them, or record "no further drift".

### Success Criteria

#### Automated Verification:
- [ ] Format: `bunx oxfmt --check`
- [ ] Nothing is left over from PK:
  `grep -rniIE 'passkey|webauthn|simplewebauthn' --exclude-dir=node_modules --exclude-dir=Pods --exclude-dir=build --exclude-dir=tasks --exclude-dir=nitrogen --exclude=bun.lock .`
  prints nothing

#### Manual Verification:
- [ ] The updated docs read correctly and match the implemented behavior

---

## Testing Strategy

### Unit Tests
- **`src/__tests__/AppleSignInError.test.ts`**: every SPEC §3 mapping row, prefix and fbjni
  tolerance, marker stripping, the empty-message fallback, non-`Error` values, and instance
  identity.
- **`src/__tests__/wrappers.test.ts`**: pass-through, the `{}` default, rejection
  normalisation, sync-throw normalisation, and the `unsupported` credential-state rejection.
- **`example/ios/NitroAppleSignInExampleTests/AppleSignInErrorTokenTests.swift`**: codes
  1000–1005 and 1099, the typed `ASAuthorizationError`, a foreign `NSError`, and the message
  format.

### Integration Tests
- `example/__tests__/apple-sign-in.harness.ts` on the simulator and emulator: module load,
  per-platform `isSupported`, and Android `unsupported` across the real JNI bridge.

### Manual Testing Steps
1. `env APPLE_TEAM_ID=… APPLE_BUNDLE_ID=… bun run --cwd example signing && bun run --cwd example pod && bun run --cwd example ios`
   (the bundle id must have Sign in with Apple enabled).
2. Sign in, and check that `state` and `nonce` match, that `aud` is the bundle id, and that
   `email`/`fullName` appear on the first authorization only.
3. Cancel the sheet and check for `canceled`. Check credential state before and after
   revoking in Settings.
4. On Android, check for `isSupported: false` and two `unsupported` errors.

## Performance Considerations
None significant. The only work is one native sheet per call. `getCredentialState` runs off
the main thread.

## Rollback Strategy
Each phase is one commit on `main`. Revert with `git revert <phase commit>`, or
`git reset --hard <previous phase commit>` since nothing is pushed. Phase 1 is the root commit;
to roll it back, delete everything but `tasks/` and start over.

## References
- Research: `tasks/2026-09-26-nitro-apple-sign-in-v1/research.md` (no commit; the reference
  repos are stamped inside it)
- SPEC: `/Volumes/CaseSensitive/GitHub/football/wc2018/tasks/2026-09-25-mobile-app-nitro-first/specs/react-native-nitro-apple-sign-in.md`
- Template: `/Volumes/CaseSensitive/GitHub/react-native-nitro-passkeys` at `3084815`, and its
  `tasks/2026-09-25-nitro-passkeys-v1/orchestration-plan.md`, whose deviation notes record
  toolchain pitfalls already solved
