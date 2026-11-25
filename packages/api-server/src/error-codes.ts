/**
 * Quill — Bilingual Error Codes
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
  FIXTURES_DISABLED: {
    code: 'FIXTURES_DISABLED',
    en: 'Fixture routes are off. They serve synthetic fixtures. Set QUILL_FIXTURES=1 to enable them.',
    fr: 'Les routes de fixtures sont arrêtées. Elles servent des données synthétiques. Définissez QUILL_FIXTURES=1 pour les activer.',
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
  AI_ERROR: {
    code: 'AI_ERROR',
    en: 'AI service error',
    fr: "Erreur du service d'IA",
  },
  AI_UNAVAILABLE: {
    code: 'AI_UNAVAILABLE',
    en: 'AI service unavailable',
    fr: "Service d'IA indisponible",
  },
  ALREADY_CONSUMED: {
    code: 'ALREADY_CONSUMED',
    en: 'Code already used',
    fr: 'Code déjà utilisé',
  },
  ANALYZE_ERROR: {
    code: 'ANALYZE_ERROR',
    en: 'Analysis failed',
    fr: "L'analyse a échoué",
  },
  AUDIT_QUERY_FAILED: {
    code: 'AUDIT_QUERY_FAILED',
    en: 'Audit query failed',
    fr: "La requête d'audit a échoué",
  },
  AUTH_ERROR: {
    code: 'AUTH_ERROR',
    en: 'Authentication error',
    fr: "Erreur d'authentification",
  },
  BAD_REQUEST: {
    code: 'BAD_REQUEST',
    en: 'Bad request',
    fr: 'Requête invalide',
  },
  CHECKOUT_FAILED: {
    code: 'CHECKOUT_FAILED',
    en: 'Checkout failed',
    fr: 'Le paiement a échoué',
  },
  CITATION_ERROR: {
    code: 'CITATION_ERROR',
    en: 'Citation error',
    fr: 'Erreur de citation',
  },
  CITATION_NOT_FOUND: {
    code: 'CITATION_NOT_FOUND',
    en: 'Citation not found',
    fr: 'Citation introuvable',
  },
  CLAIMS_INDEX_ERROR: {
    code: 'CLAIMS_INDEX_ERROR',
    en: 'Claims index error',
    fr: "Erreur de l'index des déclarations",
  },
  CLAIM_VERIFY_ERROR: {
    code: 'CLAIM_VERIFY_ERROR',
    en: 'Claim verification failed',
    fr: 'La vérification de la déclaration a échoué',
  },
  COMPLIANCE_CHECK_FAILED: {
    code: 'COMPLIANCE_CHECK_FAILED',
    en: 'Compliance check failed',
    fr: 'Le contrôle de conformité a échoué',
  },
  CONTACT_DEPRECATED: {
    code: 'CONTACT_DEPRECATED',
    en: 'This contact endpoint is deprecated',
    fr: 'Ce point de contact est obsolète',
  },
  CONTACT_SALES: {
    code: 'CONTACT_SALES',
    en: 'Contact the sales team',
    fr: "Contactez l'équipe des ventes",
  },
  DATA_QUALITY_ERROR: {
    code: 'DATA_QUALITY_ERROR',
    en: 'Data quality error',
    fr: 'Erreur de qualité des données',
  },
  ENGINE_MISSING: {
    code: 'ENGINE_MISSING',
    en: 'Engine is missing',
    fr: 'Le moteur est absent',
  },
  ENGINE_NOT_BUILT: {
    code: 'ENGINE_NOT_BUILT',
    en: 'Engine is not built',
    fr: "Le moteur n'est pas compilé",
  },
  ENGINE_RUN_FAILED: {
    code: 'ENGINE_RUN_FAILED',
    en: 'Engine run failed',
    fr: "L'exécution du moteur a échoué",
  },
  ENGINE_STATUS_FAILED: {
    code: 'ENGINE_STATUS_FAILED',
    en: 'Engine status unavailable',
    fr: "L'état du moteur est indisponible",
  },
  ERROR: {
    code: 'ERROR',
    en: 'Error',
    fr: 'Erreur',
  },
  ETRANSFER_DEPRECATED: {
    code: 'ETRANSFER_DEPRECATED',
    en: 'Interac e-transfer is deprecated',
    fr: 'Le virement Interac est obsolète',
  },
  GITHUB_AUTH_ERROR: {
    code: 'GITHUB_AUTH_ERROR',
    en: 'GitHub authentication error',
    fr: "Erreur d'authentification GitHub",
  },
  GITHUB_NOT_CONFIGURED: {
    code: 'GITHUB_NOT_CONFIGURED',
    en: 'GitHub is not configured',
    fr: "GitHub n'est pas configuré",
  },
  GITHUB_PROFILE_ERROR: {
    code: 'GITHUB_PROFILE_ERROR',
    en: 'GitHub profile error',
    fr: 'Erreur de profil GitHub',
  },
  GITHUB_TOKEN_ERROR: {
    code: 'GITHUB_TOKEN_ERROR',
    en: 'GitHub token error',
    fr: 'Erreur de jeton GitHub',
  },
  HEALTH_CHECK_FAILED: {
    code: 'HEALTH_CHECK_FAILED',
    en: 'Health check failed',
    fr: 'Le contrôle de santé a échoué',
  },
  INVALID_ADJUSTMENT: {
    code: 'INVALID_ADJUSTMENT',
    en: 'Invalid adjustment',
    fr: 'Ajustement invalide',
  },
  INVALID_BODY: {
    code: 'INVALID_BODY',
    en: 'Invalid request body',
    fr: 'Corps de requête invalide',
  },
  INVALID_CODE: {
    code: 'INVALID_CODE',
    en: 'Invalid code',
    fr: 'Code invalide',
  },
  INVALID_HASH: {
    code: 'INVALID_HASH',
    en: 'Invalid hash',
    fr: 'Empreinte invalide',
  },
  INVALID_JSON: {
    code: 'INVALID_JSON',
    en: 'Invalid JSON',
    fr: 'JSON invalide',
  },
  KEY_CREATION_FAILED: {
    code: 'KEY_CREATION_FAILED',
    en: 'Key creation failed',
    fr: 'La création de la clé a échoué',
  },
  KEY_REVOCATION_FAILED: {
    code: 'KEY_REVOCATION_FAILED',
    en: 'Key revocation failed',
    fr: 'La révocation de la clé a échoué',
  },
  KEY_ROTATION_FAILED: {
    code: 'KEY_ROTATION_FAILED',
    en: 'Key rotation failed',
    fr: 'La rotation de la clé a échoué',
  },
  ME_FAILED: {
    code: 'ME_FAILED',
    en: 'Could not load your profile',
    fr: 'Impossible de charger votre profil',
  },
  MISSING_CODE: {
    code: 'MISSING_CODE',
    en: 'Missing code',
    fr: 'Code manquant',
  },
  MISSING_ID: {
    code: 'MISSING_ID',
    en: 'Missing identifier',
    fr: 'Identifiant manquant',
  },
  MISSING_KEY_ID: {
    code: 'MISSING_KEY_ID',
    en: 'Missing key identifier',
    fr: 'Identifiant de clé manquant',
  },
  MISSING_QUERY: {
    code: 'MISSING_QUERY',
    en: 'Missing query',
    fr: 'Requête manquante',
  },
  MISSING_TOKEN: {
    code: 'MISSING_TOKEN',
    en: 'Missing token',
    fr: 'Jeton manquant',
  },
  NOT_SUPPORTED: {
    code: 'NOT_SUPPORTED',
    en: 'Not supported',
    fr: 'Non pris en charge',
  },
  OAUTH_ERROR: {
    code: 'OAUTH_ERROR',
    en: 'OAuth authentication error',
    fr: "Erreur d'authentification OAuth",
  },
  OAUTH_INVALID_STATE: {
    code: 'OAUTH_INVALID_STATE',
    en: 'Invalid OAuth state',
    fr: 'État OAuth invalide',
  },
  OAUTH_LOGIN_FAILED: {
    code: 'OAUTH_LOGIN_FAILED',
    en: 'OAuth sign-in failed',
    fr: 'La connexion OAuth a échoué',
  },
  OAUTH_PROVIDER_NOT_FOUND: {
    code: 'OAUTH_PROVIDER_NOT_FOUND',
    en: 'OAuth provider not found',
    fr: 'Fournisseur OAuth introuvable',
  },
  OPENAPI_FAILED: {
    code: 'OPENAPI_FAILED',
    en: 'OpenAPI generation failed',
    fr: 'Échec de la génération OpenAPI',
  },
  PAYLOAD_TOO_LARGE: {
    code: 'PAYLOAD_TOO_LARGE',
    en: 'Payload too large',
    fr: 'Charge utile trop volumineuse',
  },
  PAYMENT_PROVIDER_ERROR: {
    code: 'PAYMENT_PROVIDER_ERROR',
    en: 'Payment provider error',
    fr: 'Erreur du fournisseur de paiement',
  },
  PORTAL_FAILED: {
    code: 'PORTAL_FAILED',
    en: 'Portal request failed',
    fr: 'Échec de la requête du portail',
  },
  RATE_LIMIT: {
    code: 'RATE_LIMIT',
    en: 'Rate limit reached',
    fr: 'Limite de requêtes atteinte',
  },
  REGISTRATION_FAILED: {
    code: 'REGISTRATION_FAILED',
    en: 'Registration failed',
    fr: "L'inscription a échoué",
  },
  SETTINGS_ERROR: {
    code: 'SETTINGS_ERROR',
    en: 'Settings error',
    fr: 'Erreur des paramètres',
  },
  STORAGE_ERROR: {
    code: 'STORAGE_ERROR',
    en: 'Storage error',
    fr: 'Erreur de stockage',
  },
  STRIPE_NOT_CONFIGURED: {
    code: 'STRIPE_NOT_CONFIGURED',
    en: 'Stripe is not configured',
    fr: "Stripe n'est pas configuré",
  },
  TAX_LEDGER_ERROR: {
    code: 'TAX_LEDGER_ERROR',
    en: 'Tax ledger error',
    fr: 'Erreur du registre fiscal',
  },
  UPGRADE_REQUIRED: {
    code: 'UPGRADE_REQUIRED',
    en: 'This feature requires a higher plan',
    fr: 'Cette fonctionnalité nécessite une offre supérieure',
  },
  USAGE_QUERY_FAILED: {
    code: 'USAGE_QUERY_FAILED',
    en: 'Usage query failed',
    fr: "La requête d'utilisation a échoué",
  },
  VERIFICATION_FAILED: {
    code: 'VERIFICATION_FAILED',
    en: 'Verification failed',
    fr: 'La vérification a échoué',
  },
  WEBHOOK_IDENTITY_ERROR: {
    code: 'WEBHOOK_IDENTITY_ERROR',
    en: 'Webhook identity error',
    fr: "Erreur d'identité du webhook",
  },
  WEBHOOK_PROCESSING_ERROR: {
    code: 'WEBHOOK_PROCESSING_ERROR',
    en: 'Webhook processing error',
    fr: 'Erreur de traitement du webhook',
  },
  PRICE_UNAVAILABLE: {
    code: 'PRICE_UNAVAILABLE',
    en: 'Checkout is temporarily unavailable for this plan',
    fr: 'Le paiement est temporairement indisponible pour cette offre',
  },
  INVALID_PLAN: {
    code: 'INVALID_PLAN',
    en: 'Invalid plan',
    fr: 'Offre invalide',
  },
  MODULE_NOT_FOUND: {
    code: 'MODULE_NOT_FOUND',
    en: 'Module not found',
    fr: 'Module introuvable',
  },
  NO_STRIPE_CUSTOMER: {
    code: 'NO_STRIPE_CUSTOMER',
    en: 'No Stripe customer on file',
    fr: 'Aucun client Stripe enregistré',
  },
  RECORD_NOT_FOUND: {
    code: 'RECORD_NOT_FOUND',
    en: 'Record not found',
    fr: 'Enregistrement introuvable',
  },
  STALE: {
    code: 'STALE',
    en: 'Data is stale',
    fr: 'Données périmées',
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
    // An undefined code must NOT ship a placeholder translation to a bilingual
    // product: fall back to the caller's English sentence (meaningful) rather
    // than 'Erreur inconnue' (= "unknown error"), which told French readers
    // nothing (2026-09-22). Every code used at a call site is defined above;
    // error-codes-i18n.test.ts fails if a new one is not.
    fr: messageOverrides?.fr ?? messageOverrides?.en ?? 'Unknown error',
  };
  return {
    code: base.code,
    en: messageOverrides?.en ?? base.en,
    fr: messageOverrides?.fr ?? base.fr,
  };
}
