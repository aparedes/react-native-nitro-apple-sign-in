export type AppleSignInErrorCode =
  | 'canceled'
  | 'failed'
  | 'invalidResponse'
  | 'notHandled'
  | 'unsupported'
  | 'unknown';

const TOKEN_RE = /\[AppleSignIn:([A-Za-z0-9-]+)\]\s?/;
const ASAUTH_RE = /^asauth-\d+$/;
const NAMED: ReadonlySet<string> = new Set<AppleSignInErrorCode>([
  'invalidResponse',
  'unsupported',
  'unknown',
]);
const ASAUTH: Readonly<Record<string, AppleSignInErrorCode>> = {
  'asauth-1000': 'unknown',
  'asauth-1001': 'canceled',
  'asauth-1002': 'invalidResponse',
  'asauth-1003': 'notHandled',
  'asauth-1004': 'failed',
  'asauth-1005': 'unknown',
};

function codeForToken(token: string | undefined): AppleSignInErrorCode {
  if (token === undefined) return 'unknown';
  if (token in ASAUTH) return ASAUTH[token] as AppleSignInErrorCode;
  if (ASAUTH_RE.test(token)) return 'unknown';
  return NAMED.has(token) ? (token as AppleSignInErrorCode) : 'unknown';
}

export class AppleSignInError extends Error {
  readonly code: AppleSignInErrorCode;

  constructor(code: AppleSignInErrorCode, message: string) {
    super(message);
    this.name = 'AppleSignInError';
    this.code = code;
  }

  /** Normalises anything thrown by `AppleSignIn.signIn` / `getCredentialState`. Never throws. Used by the typed wrappers. */
  static from(error: unknown): AppleSignInError {
    try {
      if (error instanceof AppleSignInError) return error;
      const original =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unknown error';
      const match = TOKEN_RE.exec(original);
      const code = codeForToken(match?.[1]);
      const stripped = match ? original.replace(TOKEN_RE, '') : original;
      return new AppleSignInError(
        code,
        stripped.length > 0 ? stripped : original,
      );
    } catch {
      return new AppleSignInError('unknown', 'Unknown error');
    }
  }
}
