# Research: build `react-native-nitro-apple-sign-in` from its spec

**Date:** 2026-09-26 · **Branch:** main · **Commit:** none (the repo has no commits yet; the working tree is empty)

Reference repos (all paths below are relative to `/Volumes/CaseSensitive/GitHub/`):

| Alias | Repo | HEAD |
|---|---|---|
| `IP` | `react-native-nitro-image-pipeline` | `7c96c4b` (has uncommitted example/ios edits, see §6) |
| `PK` | `react-native-nitro-passkeys` | `3084815` |
| `NM` | `react-native-nitro-passkeys/node_modules/react-native-nitro-modules` (0.37.1) | — |
| `NG` | `react-native-nitro-passkeys/node_modules/nitrogen` (0.37.1) | — |
| `SPEC` | `football/wc2018/tasks/2026-09-25-mobile-app-nitro-first/specs/react-native-nitro-apple-sign-in.md` (561 lines, uncommitted in wc2018) | — |

## Question

Implement the spec passed to this research step (identical to `SPEC`): a Nitro HybridObject wrapping
Sign in with Apple (`AuthenticationServices`), native on iOS only, with an Android stub that rejects
with `unsupported`. It includes typed JS wrappers (`signInWithApple`, `getAppleCredentialState`), an
`AppleSignInError` token parser, bun unit tests, a Swift XCTest and an example app. The repo layout
mirrors image-pipeline.

## Summary

- The target repo is empty, so the research maps the spec against the templates it names.
- The spec names image-pipeline (`IP`) as the scaffold. The **closest template is actually
  `react-native-nitro-passkeys` (`PK`)**. It was built on 2026-09-25 from a sibling spec that cites
  this same `SPEC` as the source of its error format, window anchor, in-flight guard and bun
  `mock.module` pattern (`PK/tasks/2026-09-25-nitro-passkeys-v1/research.md:20`).
- `PK` already has, working, almost every mechanism the spec asks for:
  - the spec's exact `package.json` versions (RN 0.87.1, nitro 0.37.1, peer `>=0.37.1 <0.38.0`)
  - a literal `ios: '16.0'` podspec with `AuthenticationServices`
  - the `[Prefix:token]` error class and the Swift `ErrorToken` enum
  - a retained `ASAuthorizationController` delegate with an `NSLock` in-flight guard
  - the foreground-scene window lookup and `DispatchQueue.main` dispatch
  - a `bun test src` suite with `mock.module('react-native-nitro-modules')`
  - an app-hosted XCTest target and `static-checks.yml` running `bun test src`
- `IP` differs from the spec on versions (RN 0.84.1, nitrogen/nitro 0.37.0, peer `*`) and on the
  podspec (`min_ios_version_supported` plus visionOS). It has no `src/__tests__` and no XCTest
  target.
- Nitro 0.37.1 confirms the spec's error-transport assumptions (`String(describing:)`, no prefix on
  async rejections, a `Class.method(...): ` prefix on sync throws).

## How it works (reference implementations)

### 1. Scaffolding (from `IP`, confirmed identical in shape in `PK`)

- **`nitro.json`.** `IP/nitro.json` uses exactly the nested autolinking form the spec quotes
  (`"NitroImagePipeline": { "ios": { "language": "swift", "implementationClassName": … } }`).
  - Nitrogen 0.37.1 validates this with Zod: `autolinkingIOSImplementationSchema` and
    `autolinkingModernHybridObjectSchema` in `NG/lib/config/NitroUserConfig.js`.
  - The legacy flat `{swift, kotlin}` form is still accepted and normalised
    (`normalizeLegacyAutolinkingHybridObject`).
- **`package.json`.** `IP/package.json:10-22` (scripts), `:32-52` (`files`), `:53-55`
  (`workspaces: ["example"]`), `:93-106` (bob targets) and `:107-109` (`trustedDependencies`).
  - The spec's `files` list, scripts and dev versions match **`PK/package.json`** exactly:
    - `files` at `:26-40`, including `"!src/**/__tests__"`
    - `"test": "bun test src"` at `:16`
    - peer `react-native-nitro-modules: ">=0.37.1 <0.38.0"` at `:53-57`
    - devDeps `nitrogen 0.37.1`, `react-native 0.87.1`, `react-native-nitro-modules 0.37.1` at
      `:58-74`
  - Both repos also carry `"overrides": { "lodash-es": "4.17.21", "typescript": "$typescript" }`
    (`IP/package.json:89-92`, `PK/package.json:75-78`). The spec does not mention this field.
  - `IP` lists `"react-native.config.js"` and `"app.plugin.js"` in `files`, but neither file exists
    at its root.
- **Podspec.** The spec's podspec is `PK/NitroPasskeys.podspec`, not `IP`'s:
  - `:8` `pod_version = package["version"].sub(/[-+].*\z/, "")`, which strips prerelease suffixes
    because CocoaPods won't resolve `0.0.0-development` or `-next.N` (comment `:5-7`)
  - `:18` `s.platforms = { :ios => '16.0' }`
  - `:21-26` `s.source_files`, covering Swift plus `m,mm`
  - `:28` `s.frameworks = 'AuthenticationServices'`
  - `:30-31` `load 'nitrogen/generated/ios/NitroPasskeys+autolinking.rb'` then
    `add_nitrogen_files(s)`
  - `:33-34` `React-jsi` / `React-callinvoker` dependencies
  - `:36` `install_modules_dependencies(s)`

  By contrast, `IP/NitroImagePipeline.podspec:13` is
  `{ :ios => min_ios_version_supported, :visionos => 1.0 }`.
- **`release.config.cjs`.** `IP/release.config.cjs` has branches `['main', { name: 'next',
  prerelease: 'next' }]`, the conventionalcommits preset and emoji sections, and
  `@semantic-release/git` assets `['package.json','CHANGELOG.md','example/package.json']`.
- **Tooling files.**
  - `tsconfig.json` is strict with `noUncheckedIndexedAccess`, `verbatimModuleSyntax` and
    `include: ["src/**/*","nitrogen/**/*.json"]`.
  - `babel.config.js` uses `module:@react-native/babel-preset`.
  - `bunfig.toml` is `[install] linker = "hoisted"` only, with no `[test]` section. `PK` is the same.
  - `lefthook.yml` runs oxfmt, oxlint, ktfmt and swiftlint on pre-commit, and oxlint, oxfmt,
    typecheck, ktfmt and swiftlint on pre-push.
  - The swiftlint hook calls **`scripts/hooks/swiftlint.sh`**, which the spec's layout does not
    list.
  - `.oxlintrc.json` loads `jsPlugins: ["./.oxlint/react-native-plugin.mjs"]`, a hand-written oxlint
    plugin. The spec's layout omits `.oxlint/`.
  - `.swiftlint.yml` includes `ios` and `example/ios/<App>`, and excludes `nitrogen/generated`.
  - `.gitignore` ignores `lib/` (`:76`) but **not** `nitrogen/generated`, which is committed
    (58 files in `IP`).
  - `.watchmanconfig` ignores `lib` and `nitrogen/generated`.
- **CI** (`IP/.github/workflows/`):
  - `static-checks.yml`: `bun install --frozen-lockfile`, `oxlint --deny-warnings`,
    `oxfmt --check` and `typecheck`. `PK`'s version adds `bun test src`.
  - `ios.yml`: runs on `macos-26` with Xcode 26.4, then `pod install`, `xcodebuild` build and the
    harness action. `PK/ios.yml` adds an **"Unit tests (XCTest)"** step running `xcodebuild … test
    CODE_SIGNING_ALLOWED=NO`. `IP`'s `bun run verify:blur` step is image-specific.
  - `android.yml`: `assembleDebug`, then harness on the API 36 emulator. `PK` adds
    `./gradlew :react-native-nitro-passkeys:testDebugUnitTest`.
  - `release.yml`: `workflow_dispatch` only. It uses a GitHub App token (`APP_ID` /
    `APP_PRIVATE_KEY` secrets) and npm OIDC (`id-token: write`, `NPM_CONFIG_PROVENANCE: true`), with
    **no `NPM_TOKEN`**.
- **Android scaffold** (`IP/android/`):
  - `build.gradle:22` `apply from: '../nitrogen/generated/android/<Mod>+autolinking.gradle'`
  - `:23` `apply from: "./fix-prefab.gradle"`
  - `:30-36` reads `project.properties["<Mod>_" + name]`
  - `:39` namespace `com.margelo.nitro.<ns>`
  - `:132-150` dependencies, which are image-specific (Coil, Cronet, `react-native-nitro-image`)
  - `CMakeLists.txt`: `add_library(... cpp-adapter.cpp ...)` plus
    `include(.../<Mod>+autolinking.cmake)`. `IP` adds `GaussianBlur*`, `jnigraphics` and a
    `find_package(react-native-nitro-image)`, all image-specific.
  - `gradle.properties` defines `<Mod>_kotlinVersion`, `minSdkVersion`, `targetSdkVersion`,
    `compileSdkVersion` and `ndkVersion`.
  - **`cpp-adapter.cpp`** calls `margelo::nitro::<ns>::registerAllNatives()` inside
    `facebook::jni::initialize(vm, …)`. That is the 0.37 form; the spec's layout comment says
    `initialize(vm)`.
  - **`<Mod>Package.kt`** is a no-op `BaseReactPackage` whose `companion object { init {
    <Mod>OnLoad.initializeNative() } }` loads the JNI lib. Both `IP` and `PK` have one
    (`PK/android/src/main/java/com/margelo/nitro/nitropasskeys/NitroPasskeysPackage.kt`). The
    spec's layout does not list it.

### 2. JS surface and the error class (`PK/src/`)

- **Singleton.**
  - `PK/src/index.ts:18`:
    `const native = NitroModules.createHybridObject<NitroPasskeys>('NitroPasskeys');` It is
    deliberately *not* exported (comment `:17`).
  - `IP/src/NitroImagePipeline.ts` exports the value and aliases the spec type
    (`import type { NitroImagePipeline as NitroImagePipelineSpec }`).
  - The spec follows neither exactly: it exports the value as `AppleSignIn` and keeps the type name
    `NitroAppleSignIn`.
- **Wrappers.** `PK/src/index.ts:24-62`: `try { raw = await native.create(…) } catch (error) {
  throw PasskeyError.from(error); }`. This is the same shape as the spec's `signInWithApple`.
- **Error class** (`PK/src/PasskeyError.ts`):
  - `:20` `const TOKEN_RE = /\[Passkeys:([A-Za-z0-9-]+)\]\s?/;` — note the trailing `\s?`
  - `:21` `const ASAUTH_RE = /^asauth-\d+$/;`
  - `:23-29` `codeForToken`: specific `asauth-N` values map to named codes, any other `asauth-N` to
    `unknown`, and named tokens are looked up in the `CODES` set
  - `:31-38` the class, with `this.name = 'PasskeyError'`
  - `:41-57` `from()`: identity passthrough, `Error` / `string` / fallback message, token stripped
    with `original.replace(TOKEN_RE, '')`, falls back to the original text when stripping leaves an
    empty string, and the whole body is wrapped in `try/catch` so it never throws

### 3. iOS implementation pattern (`PK/ios/HybridNitroPasskeys.swift`)

- **Class and support flag.**
  - `:10` `final class HybridNitroPasskeys: HybridNitroPasskeysSpec, @unchecked Sendable`
  - `:11` `private let lock = NSLock()`
  - `:12-14` `private var active: PasskeyRequest?`, the strong ref, because the controller holds its
    delegate weakly
  - `:16` `var isSupported: Bool { true }`
- **`begin`** (`:26-50`):
  - takes the lock
  - `guard active == nil else { return .rejected(withError: passkeyError("unknown", "A passkey
    request is already in progress")) }`
  - `let promise = Promise<String>()`
  - `active = request`
  - `DispatchQueue.main.async { request.start() }`
  - returns the pending promise
- **Error construction** (`:70-72`): `RuntimeError.error(withMessage:
  PasskeyErrorToken.message(token: token, text))`.
- **`PasskeyRequest`** is `@MainActor` (`:76`) with a `nonisolated init`.
  - `start()` (`:96-101`) resolves the window and settles `unknown` / "No window to present on"
    before it creates the controller.
  - Delegate and presentation provider are `self` (`:112-113`).
  - `didCompleteWithError` (`:129-132`) calls `PasskeyErrorToken.token(for:)`.
  - `settle` (`:148-172`) is a once-only guard. It releases the controller *after* the delegate
    callback returns (`DispatchQueue.main.async { withExtendedLifetime(controller) {} }`).
  - `presentationAnchor(for:)` is at `:137-141`.
- **`presentationWindow()`** (`:282-289`) takes the foreground-active scene's `keyWindow` and falls
  back to `scenes.lazy.compactMap { $0.windows.first }.first`. `UIWindowScene.keyWindow` is
  iOS 15+, so it is equivalent to the spec's `windows.first { $0.isKeyWindow }`.
- **`PK/ios/PasskeyErrorToken.swift`** is an `enum` with `static func token(for error: Error) ->
  String`. It casts to `NSError`, returns `"unknown"` unless
  `nsError.domain == ASAuthorizationError.errorDomain`, and otherwise returns
  `"asauth-\(nsError.code)"`. It also has `static func message(token:_:)`, which returns
  `"[Passkeys:\(token)] \(text)"`.

### 4. Android stub pattern (`PK/android/.../HybridNitroPasskeys.kt`)

- `PK` has a real Android implementation. Its reject mechanisms are:
  - `Promise.rejected(Error("[Passkeys:unknown] …"))` for a synchronous reject (`:50-53`)
  - `Promise.async(mainScope) { … }` for async work
- The Kotlin Promise API lives in `NM/android/src/main/java/com/margelo/nitro/core/Promise.kt`:
  `rejected(error: Throwable)` at `:187-189` and `async(scope, run)` at `:141-155`.
- A Kotlin `Throwable` reaches JS through fbjni's `JniException`, whose `what()` is the Java
  message. The exact `populateWhat()` text format is compiled into fbjni and was not inspected (see
  open questions).

### 5. Nitro 0.37.1 error transport (confirms spec §3)

- **Swift errors.** `NM/ios/core/RuntimeError.swift:41-44`: `Error.toCpp()` uses
  `String(describing: self)`. `RuntimeError.error(withMessage:)` has `description` equal to the
  message (`:12-19`).
- **Async rejections carry no prefix.** `NM/cpp/jsi/JSIConverter+Exception.hpp:40-42` builds the
  JS error with `jsi::JSError(runtime, e.what())`. It is used by
  `JSIConverter+Promise.hpp:87-90`.
- **Sync throws get a prefix.** `NM/cpp/core/HybridFunction.hpp:120-124` builds
  `funcName + ": " + message`, where `funcName` is `TypeName.method(...)` (`:244-254`). This is the
  case the spec's regex-anywhere design and its "synchronous throw" wrapper test cover.
- **Swift `Promise`** (`NM/ios/core/Promise.swift`): `init()` at `:39`,
  `resolve(withResult:)` at `:55`, `reject(withError:)` at `:77`, `rejected(withError:)` at `:111`
  and `async` at `:121`.

### 6. Tests and example app

- **bun tests.**
  - `PK/src/__tests__/index.test.ts:1-14` shows the exact `mock.module(...)` setup followed by
    `await import('../index')` that the spec's `wrappers.test.ts` describes.
  - `:128` covers "synchronous native throw → rejected PasskeyError".
  - `PK/src/__tests__/PasskeyError.test.ts:50-57` covers the prefix-kept, marker-stripped case.
- **XCTest** (`PK/example/ios/NitroPasskeysExampleTests/`):
  - An app-hosted unit-test bundle, `productType = "com.apple.product-type.bundle.unit-test"`
    (`project.pbxproj:195`), with `TEST_HOST` and `BUNDLE_LOADER` set.
  - Tests use `@testable import NitroPasskeys`.
  - The Podfile nests `target 'NitroPasskeysExampleTests' do inherit! :search_paths end` (`:29`).
    Its comment says `:complete` would register the HybridObject twice and abort.
  - A `post_install` hook sets `ENABLE_TESTABILITY = YES` on the pod's Debug config (`:43`).
  - The Podfile uses `platform :ios, '16.0'`.
- **Entitlements.** `PK/example/ios/NitroPasskeysExample/NitroPasskeysExample.entitlements` is
  wired through `CODE_SIGN_ENTITLEMENTS` on the app target only (`project.pbxproj:389,421`).
  - No `DEVELOPMENT_TEAM` is set; signing is Automatic.
  - Bundle ids are `com.nitropasskeysexample` and `com.nitropasskeysexample.tests`.
- **Scene-based boot.** `PK` boots the app per scene:
  - `AppDelegate.swift:22` notes "the window is created per scene in SceneDelegate".
  - `SceneDelegate.swift` calls `factory.startReactNative(... in: window ...)`.
  - `IP` has an **uncommitted, untracked** `example/ios/SceneDelegate.swift` plus modified
    `project.pbxproj` / `Info.plist`. This is local state, not the committed baseline.
- **Example app wiring.**
  - `IP/example/babel.config.js` aliases the package to `../src` through `module-resolver`.
  - `example/react-native.config.js` registers `root: '..'`.
  - `metro.config.js` sets `watchFolders: [root]`.
  - The root package is not listed in `example/package.json`.
  - Harness config is in `example/rn-harness.config.mjs`, with the `iphone-17` (iOS 26.4) and
    `medium_phone_api_36.1` runners.
- **`PK/example/App.tsx`** formats errors as `` `${code}: ${message}` ``, with `'non-PasskeyError'`
  as the fallback.

### 7. Consumers

- `@wc/mobile` is at `football/wc2018/apps/mobile/package.json`.
  `football/wc2018/docs/architecture/mobile.md:38,219` references this package.
- HoloCatch uses RN `0.87.1` (`holocatch/package.json:54`) and nitro-modules `0.37.1` (`:66`). It
  has no Apple sign-in code today.
- HoloCatch's nitrogen patch is applied via bun `patchedDependencies`
  (`holocatch/package.json:115-118`).
  - It rewrites the Swift codegen for `error`-kind params from `RuntimeError.from(cppError:)` to
    `RuntimeError.error(withMessage: String(margelo.nitro.getExceptionMessage(…)))`.
  - `PK` ships **without** that patch and builds, and its spec has no error-taking callbacks either.

## Where the change lands (every file is new)

- **Copy from `PK`, renaming `Passkeys`/`passkeys` to `AppleSignIn`/`applesignin`:**
  - `package.json` (drop `@simplewebauthn/server` and `example:server`)
  - the podspec
  - `.oxlintrc.json`, `.oxfmtrc.json`, `.oxlint/` and `.swiftlint.yml`
  - `lefthook.yml` and `scripts/hooks/swiftlint.sh`
  - `bunfig.toml`, `tsconfig.json` and `babel.config.js`
  - `release.config.cjs`
  - `.github/workflows/*` and `dependabot.yml`
  - `android/{build.gradle,fix-prefab.gradle,gradle.properties,CMakeLists.txt}`, dropping the
    credentials and coroutines deps
  - `cpp-adapter.cpp` and `<Mod>Package.kt`
  - `example/` scaffolding (Podfile with the test target, SceneDelegate, entitlements)
- **Written fresh from the spec:**
  - `src/specs/nitro-apple-sign-in.nitro.ts`
  - `src/index.ts`
  - `src/AppleSignInError.ts`
  - `src/__tests__/*`
  - `ios/HybridNitroAppleSignIn.swift` and `ios/AppleSignInErrorToken.swift`
  - `HybridNitroAppleSignIn.kt`
  - `example/App.tsx`
  - the XCTest for `AppleSignInErrorToken`
  - the README
- **Constraints:**
  - `nitrogen/generated/` must be committed, because it ships in `files`.
  - The `createHybridObject` name must equal the `nitro.json` autolinking key, `NitroAppleSignIn`.
  - The XCTest target must use `inherit! :search_paths`.
  - The pod version must strip the prerelease suffix while the package is on `next` prereleases.

## Open questions

1. **Regex and message stripping.** The spec regex `/\[AppleSignIn:([A-Za-z0-9-]+)\]/` has no
   trailing `\s?`, unlike `PK` (`PasskeyError.ts:20`). Stripping only the token leaves a leading
   space (`" The operation…"`). Should the token regex include `\s?`, as in `PK`? And should `from()`
   fall back to the original text when stripping leaves nothing, as `PK` does?
2. **Structured Nitro types.** The spec uses real structs, string-union enums, an optional array
   (`scopes?: AppleAuthScope[]`) and an optional nested struct (`fullName?`). No on-disk repo has
   generated code for an **optional array of enums**, so its codegen is unverified. `PK` passes JSON
   strings instead. Structs and unions are confirmed in `IP`'s generated `ResizeFit.swift` and
   `Options.swift`.
3. **Unlisted files.** The spec layout omits `android/.../NitroAppleSignInPackage.kt`,
   `.oxlint/react-native-plugin.mjs`, `scripts/hooks/swiftlint.sh`, `example/ios/SceneDelegate.swift`
   and `dependabot.yml`. All of them exist in both templates. Should they be added?
4. **`cpp-adapter.cpp` form.** The spec's layout comment says `initialize(vm)`. Both templates call
   `facebook::jni::initialize(vm, [] { margelo::nitro::<ns>::registerAllNatives(); })`, which is
   the form Nitrogen 0.37 generates. Is the spec comment shorthand for that?
5. **Unsupported vs. wrapper-only, on Android.** `PK`'s JS wrappers short-circuit on `isSupported`
   *before* calling native. The spec explicitly says no short-circuit and relies on the Kotlin
   rejection. The spec's choice is settled; it is listed only to flag the divergence from the
   sibling.
6. **Android JNI message.** The exact message text fbjni's `JniException::what()` produces for a
   Kotlin `Error("[AppleSignIn:unsupported] …")` was not inspected. The regex-anywhere design
   tolerates any prefix or suffix, but no Android harness run has confirmed it.
7. **Example signing.** Which bundle id and team with the Sign in with Apple capability should the
   example use? `PK` sets no `DEVELOPMENT_TEAM`, and the XCTest and simulator build run with
   `CODE_SIGNING_ALLOWED=NO`.
8. **`overrides` field.** Both templates carry `"overrides": { "lodash-es", "typescript" }` and the
   spec's `package.json` omits it. Should it be copied?

## Follow-up: answers to the open questions (2026-09-26)

The user's answers, and what was verified for each:

1. **Regex and stripping.** Adopt `PK`'s form: the token regex is `/\[AppleSignIn:([A-Za-z0-9-]+)\]\s?/`,
   and `from()` falls back to the original text when stripping leaves nothing (`PK/src/PasskeyError.ts:20,53`).
2. **Optional array of enums.** *Verified* by running stock nitrogen 0.37.1 on the spec §3 file
   verbatim, in a scratch dir.
   - The run generated 1/1 HybridObject with no errors.
   - `AppleAuthRequest.swift:21` has `init(scopes: [AppleAuthScope]?, nonce: String?, state: String?)`.
   - `:50` exposes `var scopes: [AppleAuthScope]?`, bridged via `std__optional_std__vector_AppleAuthScope__`.
   - The protocol is `func signIn(request: AppleAuthRequest) throws -> Promise<AppleAuthCredential>` and
     `func getCredentialState(user: String) throws -> Promise<AppleCredentialState>`.
   - **The spec's claim about the HoloCatch patch is wrong.** Spec §2 says the patched
     `RuntimeError.from(cppError:)` path "only runs for callbacks that take an error, and this spec
     has none". In fact nitrogen emits `Func_void_std__exception_ptr.swift:25`
     (`self.closure(RuntimeError.from(cppError: error))`) for **any** `Promise` return.
   - `PK` has the same generated file (`PK/nitrogen/generated/ios/swift/Func_void_std__exception_ptr.swift`)
     and ships unpatched, so stock nitrogen is expected to compile. The patch stays the fallback if
     it doesn't.
3. **Unlisted files.** Add all five: `NitroAppleSignInPackage.kt`, `.oxlint/react-native-plugin.mjs`,
   `scripts/hooks/swiftlint.sh`, `example/ios/.../SceneDelegate.swift` and `.github/dependabot.yml`.
4. **`cpp-adapter.cpp`.** Use the `registerAllNatives()` form, as in both templates.
5. **`isSupported` short-circuit.** No JS short-circuit. The user notes the API has long been
   available on every iOS version the module supports. `isSupported` is always `true` on iOS, and
   Android rejects natively with `unsupported`. The spec stands.
6. **Android JNI message format.** Not worth a dedicated investigation.
   - The regex matches the token anywhere in the message.
   - fbjni's `JniException::what()` carries the Java throwable's message.
   - The example app on Android already shows the `unsupported` code (spec §6), which confirms it
     end to end at no extra cost.
7. **Example signing.** Supply the bundle id and development team through environment variables,
   so anyone can test with their own App ID. Plain Xcode-GUI builds don't inherit shell env, so the
   plan must choose how these values reach build settings:
   - `PK` injects a custom build setting, `PASSKEYS_RP_ID` (`project.pbxproj:404,435`).
   - `PK/example/ios` also has a `.xcode.env.local`.
   - CI keeps `CODE_SIGNING_ALLOWED=NO`.
8. **`overrides`.** Copy `"overrides": { "lodash-es": "4.17.21", "typescript": "$typescript" }` into `package.json`.
