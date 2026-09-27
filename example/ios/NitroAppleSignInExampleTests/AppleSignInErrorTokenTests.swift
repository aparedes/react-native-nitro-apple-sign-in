import AuthenticationServices
@testable import NitroAppleSignIn
import XCTest

final class AppleSignInErrorTokenTests: XCTestCase {
  func testAuthorizationErrorCodesMapToAsauthTokens() {
    for code in 1000...1005 {
      let error = NSError(domain: ASAuthorizationError.errorDomain, code: code)
      XCTAssertEqual(AppleSignInErrorToken.token(for: error), "asauth-\(code)")
    }
  }

  func testTypedAuthorizationErrorMapsToAsauthToken() {
    XCTAssertEqual(AppleSignInErrorToken.token(for: ASAuthorizationError(.canceled)), "asauth-1001")
  }

  func testUnlistedAuthorizationErrorCodeKeepsItsCode() {
    let error = NSError(domain: ASAuthorizationError.errorDomain, code: 1099)
    XCTAssertEqual(AppleSignInErrorToken.token(for: error), "asauth-1099")
  }

  func testForeignDomainMapsToUnknown() {
    let error = NSError(domain: NSURLErrorDomain, code: -1)
    XCTAssertEqual(AppleSignInErrorToken.token(for: error), "unknown")
  }

  func testMessageFormat() {
    XCTAssertEqual(AppleSignInErrorToken.message(token: "asauth-1001", "x"), "[AppleSignIn:asauth-1001] x")
  }
}
