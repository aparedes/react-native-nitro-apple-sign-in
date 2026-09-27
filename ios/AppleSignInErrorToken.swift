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
