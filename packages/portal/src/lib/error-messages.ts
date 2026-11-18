// Human-friendly error messages for Quill API error codes.
// Maps API error codes to actionable messages with CTAs.

export interface ErrorMessage {
  message: { en: string; fr: string };
  action: string;
  actionUrl: string;
}

export const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  UPGRADE_REQUIRED: {
    message: {
      en: "This feature requires a Pro or Business plan.",
      fr: "Cette fonctionnalité nécessite une offre Pro ou Business.",
    },
    action: "Upgrade your plan",
    actionUrl: "/pricing",
  },
  RATE_LIMITED: {
    message: {
      en: "You've hit your daily rate limit. Try again later.",
      fr: "Vous avez atteint votre limite quotidienne. Réessayez plus tard.",
    },
    action: "Check your usage",
    actionUrl: "/dashboard",
  },
  UNAUTHORIZED: {
    message: {
      en: "Your API key is invalid or missing.",
      fr: "Votre clé API est invalide ou manquante.",
    },
    action: "Get an API key",
    actionUrl: "/signup",
  },
  NOT_FOUND: {
    message: {
      en: "The requested resource was not found.",
      fr: "La ressource demandée n'a pas été trouvée.",
    },
    action: "Browse the data explorer",
    actionUrl: "/explorer",
  },
  CITATION_NOT_FOUND: {
    message: {
      en: "This citation hash was not found in the store.",
      fr: "Ce hachage de citation n'a pas été trouvé.",
    },
    action: "Browse recent citations",
    actionUrl: "/verify",
  },
  STORAGE_ERROR: {
    message: {
      en: "A storage error occurred. Please try again.",
      fr: "Une erreur de stockage s'est produite. Veuillez réessayer.",
    },
    action: "Report an issue",
    actionUrl: "https://github.com/maplespike/quill/issues",
  },
  KEY_CREATION_FAILED: {
    message: {
      en: "Failed to create API key. Please try again.",
      fr: "Échec de la création de la clé API. Veuillez réessayer.",
    },
    action: "Contact support",
    actionUrl: "/contact",
  },
};

export function getErrorMessage(code: string, lang: "en" | "fr" = "en"): string {
  const entry = ERROR_MESSAGES[code];
  if (!entry) return code;
  return entry.message[lang];
}

export function getErrorAction(code: string): { action: string; actionUrl: string } | null {
  const entry = ERROR_MESSAGES[code];
  if (!entry) return null;
  return { action: entry.action, actionUrl: entry.actionUrl };
}