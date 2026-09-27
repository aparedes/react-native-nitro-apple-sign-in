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
