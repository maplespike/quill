/**
 * MapleSpike — Bilingual Error Codes
 *
 * Central registry of all API error codes with bilingual (EN/FR) messages.
 * Every error response includes both languages so clients can render
 * whichever locale they prefer regardless of Accept-Language.
 */

export interface BilingualError {
  en: string;
  fr: string;
  code: string;
}

/**
 * Detect the user's preferred locale from Accept-Language header or ?lang query param.
 * Returns 'en' or 'fr'.
 */
export function detectLocale(
  acceptLanguage: string | null,
  langParam: string | null,
): 'en' | 'fr' {
  if (langParam === 'fr' || langParam === 'fr-CA' || langParam === 'fr-ca') return 'fr';
  if (acceptLanguage) {
    const first = acceptLanguage.split(',')[0]?.trim().toLowerCase() ?? '';
    if (first.startsWith('fr')) return 'fr';
  }
  return 'en';
}

/**
 * Canonical bilingual error code registry.
 * The `code` field is a concise machine-readable identifier.
 * Both `en` (English) and `fr` (French) messages are always present.
 */
export const ERROR_CODES: Record<string, BilingualError> = {
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    en: 'Internal server error',
    fr: 'Erreur interne du serveur',
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    en: 'Resource not found',
    fr: 'Ressource non trouvée',
  },
  METHOD_NOT_ALLOWED: {
    code: 'METHOD_NOT_ALLOWED',
    en: 'Method not allowed',
    fr: 'Méthode non autorisée',
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    en: 'Service temporarily unavailable',
    fr: 'Service temporairement indisponible',
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    en: 'Rate limit exceeded. Please slow down.',
    fr: 'Limite de débit dépassée. Veuillez ralentir.',
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    en: 'Authentication required',
    fr: 'Authentification requise',
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    en: 'You do not have permission to access this resource',
    fr: 'Vous n\'avez pas la permission d\'accéder à cette ressource',
  },
  KEY_NOT_FOUND: {
    code: 'KEY_NOT_FOUND',
    en: 'API key not found',
    fr: 'Clé API introuvable',
  },
  KEY_EXPIRED: {
    code: 'KEY_EXPIRED',
    en: 'API key has expired',
    fr: 'La clé API a expiré',
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    en: 'Invalid or expired authentication token',
    fr: 'Jeton d\'authentification invalide ou expiré',
  },
  REGISTRATION_CLOSED: {
    code: 'REGISTRATION_CLOSED',
    en: 'Registration is currently closed',
    fr: 'Les inscriptions sont actuellement fermées',
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    en: 'Invalid email or password',
    fr: 'Courriel ou mot de passe invalide',
  },
  ACCOUNT_LOCKED: {
    code: 'ACCOUNT_LOCKED',
    en: 'Account temporarily locked. Try again later.',
    fr: 'Compte temporairement verrouillé. Réessayez plus tard.',
  },
  EMAIL_TAKEN: {
    code: 'EMAIL_TAKEN',
    en: 'An account with this email already exists',
    fr: 'Un compte avec cette adresse courriel existe déjà',
  },
  INSUFFICIENT_CREDITS: {
    code: 'INSUFFICIENT_CREDITS',
    en: 'Insufficient credits. Please upgrade your plan or top up.',
    fr: 'Crédits insuffisants. Veuillez mettre à niveau votre forfait.',
  },
  ORDER_NOT_FOUND: {
    code: 'ORDER_NOT_FOUND',
    en: 'Order not found',
    fr: 'Commande non trouvée',
  },
  PAYMENT_FAILED: {
    code: 'PAYMENT_FAILED',
    en: 'Payment processing failed. Please try again.',
    fr: 'Le traitement du paiement a échoué. Veuillez réessayer.',
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    en: 'Validation error',
    fr: 'Erreur de validation',
  },
  CONFIG_ERROR: {
    code: 'CONFIG_ERROR',
    en: 'Server configuration error',
    fr: 'Erreur de configuration du serveur',
  },
  NOT_AVAILABLE: {
    code: 'NOT_AVAILABLE',
    en: 'Service not available',
    fr: 'Service non disponible',
  },
  INVALID_REQUEST: {
    code: 'INVALID_REQUEST',
    en: 'Invalid request',
    fr: 'Requête invalide',
  },
};

/**
 * Build a bilingual error object from a code.
 * Returns both languages plus the machine-readable code.
 */
export function buildBilingualError(
  code: string,
  messageOverrides?: { en?: string; fr?: string },
): BilingualError {
  const base = ERROR_CODES[code] ?? {
    code,
    en: messageOverrides?.en ?? 'Unknown error',
    fr: messageOverrides?.fr ?? 'Erreur inconnue',
  };
  return {
    code: base.code,
    en: messageOverrides?.en ?? base.en,
    fr: messageOverrides?.fr ?? base.fr,
  };
}
