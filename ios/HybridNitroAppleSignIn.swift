import AuthenticationServices
import Foundation
import NitroModules
import UIKit

/// Sign in with Apple on top of `ASAuthorizationAppleIDProvider`.
///
/// `active` is only read or written under `lock`. That is what makes the `@unchecked Sendable`
/// sound: JS calls arrive on the JS thread, settlement happens on the main thread.
final class HybridNitroAppleSignIn: HybridNitroAppleSignInSpec, @unchecked Sendable {
  private let lock = NSLock()
  /// The in-flight sign-in. Also the strong reference that keeps the helper alive, because
  /// `ASAuthorizationController` only holds its delegate weakly.
  private var active: AppleSignInRequest?

  var isSupported: Bool { true }

  func signIn(request: AppleAuthRequest) throws -> Promise<AppleAuthCredential> {
    // Convert to Sendable values on the calling thread, before the main-actor hop.
    let parameters = AppleSignInParameters(request: request)

    lock.lock()
    defer { lock.unlock() }

    guard active == nil else {
      return .rejected(withError: appleSignInError("unknown", "A sign-in request is already in progress"))
    }

    let promise = Promise<AppleAuthCredential>()
    let signInRequest = AppleSignInRequest(parameters: parameters, promise: promise) { [weak self] settled in
      self?.clear(settled)
    }
    active = signInRequest
    DispatchQueue.main.async {
      signInRequest.start()
    }
    return promise
  }

  func getCredentialState(user: String) throws -> Promise<AppleCredentialState> {
    let promise = Promise<AppleCredentialState>()
    ASAuthorizationAppleIDProvider().getCredentialState(forUserID: user) { state, error in
      if let error {
        promise.reject(withError: appleSignInError(AppleSignInErrorToken.token(for: error), error.localizedDescription))
        return
      }
      promise.resolve(withResult: credentialState(from: state))
    }
    return promise
  }

  /// Called exactly once per request, by `AppleSignInRequest.settle`, before the promise settles so
  /// a follow-up call made from the JS continuation is not rejected as "in progress".
  private func clear(_ request: AppleSignInRequest) {
    lock.lock()
    defer { lock.unlock() }
    if active === request {
      active = nil
    }
  }
}

private func appleSignInError(_ token: String, _ text: String) -> Error {
  RuntimeError.error(withMessage: AppleSignInErrorToken.message(token: token, text))
}

private func credentialState(from state: ASAuthorizationAppleIDProvider.CredentialState) -> AppleCredentialState {
  switch state {
  case .authorized:
    return .authorized
  case .revoked:
    return .revoked
  case .notFound:
    return .notfound
  case .transferred:
    return .transferred
  @unknown default:
    return .notfound
  }
}

/// `ASAuthorizationAppleIDCredential.realUserStatus` is typed `ASUserDetectionStatus` in Swift.
private func realUserStatus(from status: ASUserDetectionStatus) -> AppleRealUserStatus {
  switch status {
  case .unsupported:
    return .unsupported
  case .unknown:
    return .unknown
  case .likelyReal:
    return .likelyreal
  @unknown default:
    return .unknown
  }
}

/// The `Sendable` subset of an `AppleAuthRequest`, captured on the JS thread.
private struct AppleSignInParameters: Sendable {
  let scopes: [ASAuthorization.Scope]
  let nonce: String?
  let state: String?

  init(request: AppleAuthRequest) {
    var scopes: [ASAuthorization.Scope] = []
    for scope in request.scopes ?? [] {
      let mapped: ASAuthorization.Scope
      switch scope {
      case .email:
        mapped = .email
      case .fullname:
        mapped = .fullName
      }
      if !scopes.contains(mapped) {
        scopes.append(mapped)
      }
    }
    self.scopes = scopes
    // Verbatim: no hashing, no trimming.
    self.nonce = request.nonce
    self.state = request.state
  }
}

/// One sign-in. Lives on the main actor (the AuthenticationServices protocols are UI-actor
/// isolated); only `init` runs on the calling JS thread.
@MainActor
private final class AppleSignInRequest: NSObject {
  private let parameters: AppleSignInParameters
  private let promise: Promise<AppleAuthCredential>
  private let onSettle: @Sendable (AppleSignInRequest) -> Void
  private var anchor: ASPresentationAnchor?
  private var controller: ASAuthorizationController?
  private var settled = false

  nonisolated init(
    parameters: AppleSignInParameters,
    promise: Promise<AppleAuthCredential>,
    onSettle: @escaping @Sendable (AppleSignInRequest) -> Void
  ) {
    self.parameters = parameters
    self.promise = promise
    self.onSettle = onSettle
    super.init()
  }

  func start() {
    guard let window = Self.presentationWindow() else {
      settle(.failure(appleSignInError("unknown", "No window to present on")))
      return
    }
    anchor = window

    let request = ASAuthorizationAppleIDProvider().createRequest()
    request.requestedScopes = parameters.scopes
    request.nonce = parameters.nonce
    request.state = parameters.state

    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.presentationContextProvider = self
    self.controller = controller
    controller.performRequests()
  }
}

extension AppleSignInRequest: ASAuthorizationControllerDelegate {
  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithAuthorization authorization: ASAuthorization
  ) {
    settle(Self.credential(from: authorization))
  }

  func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
    settle(.failure(appleSignInError(AppleSignInErrorToken.token(for: error), error.localizedDescription)))
  }
}

extension AppleSignInRequest: ASAuthorizationControllerPresentationContextProviding {
  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    anchor ?? ASPresentationAnchor()
  }
}

extension AppleSignInRequest {
  /// Resolves or rejects the promise at most once and releases the in-flight slot.
  private func settle(_ result: Result<AppleAuthCredential, Error>) {
    guard !settled else { return }
    settled = true

    // Release the controller after the current delegate callback has returned, not while the
    // controller is still on the stack calling us.
    if let controller {
      controller.delegate = nil
      controller.presentationContextProvider = nil
      DispatchQueue.main.async {
        withExtendedLifetime(controller) {}
      }
    }
    controller = nil
    anchor = nil

    onSettle(self)

    switch result {
    case .success(let credential):
      promise.resolve(withResult: credential)
    case .failure(let error):
      promise.reject(withError: error)
    }
  }

  private static func credential(from authorization: ASAuthorization) -> Result<AppleAuthCredential, Error> {
    guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
      return .failure(appleSignInError("invalidResponse", "Unexpected credential type"))
    }
    guard let identityToken = credential.identityToken.flatMap({ String(data: $0, encoding: .utf8) }) else {
      return .failure(appleSignInError("invalidResponse", "Missing or non-UTF-8 identity token"))
    }
    guard let authorizationCode = credential.authorizationCode.flatMap({ String(data: $0, encoding: .utf8) }) else {
      return .failure(appleSignInError("invalidResponse", "Missing or non-UTF-8 authorization code"))
    }
    return .success(
      AppleAuthCredential(
        user: credential.user,
        identityToken: identityToken,
        authorizationCode: authorizationCode,
        email: credential.email,
        fullName: fullName(from: credential.fullName),
        realUserStatus: realUserStatus(from: credential.realUserStatus),
        state: credential.state
      )
    )
  }

  private static func fullName(from components: PersonNameComponents?) -> AppleAuthFullName? {
    guard let components else { return nil }
    let givenName = nonEmpty(components.givenName)
    let familyName = nonEmpty(components.familyName)
    if givenName == nil && familyName == nil {
      return nil
    }
    return AppleAuthFullName(givenName: givenName, familyName: familyName)
  }

  private static func nonEmpty(_ value: String?) -> String? {
    guard let value, !value.isEmpty else { return nil }
    return value
  }

  /// Key window of the foreground-active scene, else the first window of any connected scene.
  private static func presentationWindow() -> UIWindow? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let activeScene = scenes.first { $0.activationState == .foregroundActive }
    if let keyWindow = activeScene?.keyWindow {
      return keyWindow
    }
    return scenes.lazy.compactMap { $0.windows.first }.first
  }
}
