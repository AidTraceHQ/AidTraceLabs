const developmentOnlyPseudonymFallback = 'aidtrace-development-only-pseudonym-secret';

export function resolvePseudonymSecret(environment: NodeJS.ProcessEnv = process.env): string {
  const configuredSecret = environment.PSEUDONYM_SECRET;
  if (
    configuredSecret &&
    Buffer.byteLength(configuredSecret) >= 32 &&
    !configuredSecret.startsWith('replace-with-')
  ) {
    return configuredSecret;
  }
  if (!configuredSecret && environment.NODE_ENV === 'development') {
    return developmentOnlyPseudonymFallback;
  }
  throw new Error('PSEUDONYM_SECRET must contain at least 32 bytes.');
}
