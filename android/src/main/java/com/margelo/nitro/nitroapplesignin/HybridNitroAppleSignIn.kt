package com.margelo.nitro.nitroapplesignin

import com.margelo.nitro.core.Promise

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
