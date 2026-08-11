/**
 * MapleSpike i18n — Shared type definitions
 */

export type Locale = 'en' | 'fr';

export type TranslationKeys =
  // Navigation
  | 'nav.home' | 'nav.dashboard' | 'nav.docs' | 'nav.api' | 'nav.pricing'
  | 'nav.signup' | 'nav.login' | 'nav.blog' | 'nav.contact'
  | 'nav.billing' | 'nav.extraction' | 'nav.settings'
  | 'nav.api_keys' | 'nav.watcher' | 'nav.owasp' | 'nav.explorer'
  | 'nav.signal' | 'nav.status' | 'nav.citation' | 'nav.verify' | 'nav.claims' | 'nav.agents'
  | 'nav.workspace' | 'nav.changelog' | 'nav.privacy' | 'nav.terms'

  // Verify a Claim
  | 'verify.title' | 'verify.subtitle'
  | 'verify.input.placeholder' | 'verify.input.label'
  | 'verify.button' | 'verify.button.working'
  | 'verify.invalid' | 'verify.notfound' | 'verify.error'
  | 'verify.verified' | 'verify.unverified'
  | 'verify.result.source' | 'verify.result.retrieved' | 'verify.result.license'
  | 'verify.result.updated' | 'verify.result.claim' | 'verify.result.command'
  | 'verify.result.sha256' | 'verify.result.hash'
  | 'verify.how.title' | 'verify.how.body'
  | 'verify.public.title' | 'verify.public.body'
  | 'verify.other.title' | 'verify.other.body' | 'verify.other.input'
  | 'verify.other.hash' | 'verify.other.button'
  | 'verify.other.matches' | 'verify.other.mismatch' | 'verify.other.recomputed'

  // Claims index (public discovery)
  | 'claims.title' | 'claims.subtitle'
  | 'claims.empty' | 'claims.error'
  | 'claims.source' | 'claims.retrieved' | 'claims.verify'
  | 'claims.loading' | 'claims.live' | 'claims.bundle' | 'claims.bundles'
  | 'claims.how.title' | 'claims.how.body'

  // Footer
  | 'footer.tagline' | 'footer.privacy' | 'footer.terms'
  | 'footer.contact' | 'footer.github' | 'footer.status'
  | 'footer.documentation' | 'footer.company' | 'footer.legal'

  // Language switcher
  | 'lang.switch' | 'lang.en' | 'lang.fr'
  | 'lang.en_label' | 'lang.fr_label'

  // Common UI
  | 'common.loading' | 'common.error' | 'common.success' | 'common.save'
  | 'common.cancel' | 'common.delete' | 'common.edit' | 'common.close'
  | 'common.copy' | 'common.download' | 'common.upload' | 'common.search'
  | 'common.filter' | 'common.sort' | 'common.refresh'
  | 'common.back' | 'common.next' | 'common.prev'
  | 'common.confirm' | 'common.yes' | 'common.no'
  | 'common.submit' | 'common.reset' | 'common.apply'
  | 'common.show' | 'common.hide' | 'common.more' | 'common.less'
  | 'common.all' | 'common.none' | 'common.required'

  // Search
  | 'search.placeholder' | 'search.button' | 'search.results'
  | 'search.no_results' | 'search.filter_category'

  // Auth
  | 'auth.login' | 'auth.logout' | 'auth.register'
  | 'auth.api_key' | 'auth.profile' | 'auth.email'
  | 'auth.password' | 'auth.forgot_password' | 'auth.reset_password'
  | 'auth.verify_email'

  // Dashboard
  | 'dashboard.title' | 'dashboard.overview'
  | 'dashboard.welcome' | 'dashboard.stats.queries'
  | 'dashboard.stats.credits' | 'dashboard.stats.modules'
  | 'dashboard.stats.tools'
  | 'dashboard.tab.overview' | 'dashboard.tab.billing'
  | 'dashboard.tab.extraction' | 'dashboard.tab.settings'
  | 'dashboard.tab.api_keys' | 'dashboard.tab.watcher'
  | 'dashboard.tab.owasp'

  // Home/Landing
  | 'home.hero.title' | 'home.hero.subtitle' | 'home.hero.cta'
  | 'home.stats.modules' | 'home.stats.tools' | 'home.stats.datasets'
  | 'home.stats.citations' | 'home.stats.sources'
  | 'home.feature.mcp' | 'home.feature.ai' | 'home.feature.entity'
  | 'home.feature.realtime' | 'home.feature.bilingual'
  | 'home.section.features' | 'home.section.testimonials'
  | 'home.cta.get_started' | 'home.cta.learn_more'
  | 'home.cta.view_docs'

  // Billing
  | 'billing.plan.free' | 'billing.plan.pro' | 'billing.plan.enterprise'
  | 'billing.feature.mcp_tools' | 'billing.feature.rag'
  | 'billing.feature.api' | 'billing.feature.api_access'
  | 'billing.feature.rate_limit' | 'billing.feature.support'
  | 'billing.feature.advanced_search' | 'billing.feature.entity_resolution'
  | 'billing.feature.real_time' | 'billing.feature.white_label'
  | 'billing.cta.upgrade' | 'billing.cta.current'
  | 'billing.cta.get_started' | 'billing.cta.contact'
  | 'billing.monthly' | 'billing.yearly' | 'billing.save'
  | 'billing.faq.title' | 'billing.credits_remaining'

  // Extraction
  | 'extraction.title'
  | 'extraction.status.pending' | 'extraction.status.extracting'
  | 'extraction.status.done' | 'extraction.status.cached'
  | 'extraction.status.error'
  | 'extraction.button.run_all' | 'extraction.button.retry'
  | 'extraction.source.nwt' | 'extraction.source.nunavut'

  // API Keys
  | 'api_key.title' | 'api_key.create' | 'api_key.revoke'
  | 'api_key.copy' | 'api_key.name' | 'api_key.last_used'
  | 'api_key.created' | 'api_key.no_keys'

  // AI Settings
  | 'settings.ai.title' | 'settings.ai.provider' | 'settings.ai.model'
  | 'settings.ai.temperature' | 'settings.ai.max_tokens'
  | 'settings.save' | 'settings.reset'

  // Security/OWASP
  | 'security.title' | 'security.overview' | 'security.findings'
  | 'security.resolved' | 'security.critical' | 'security.high'
  | 'security.medium' | 'security.low'
  | 'security.last_scan' | 'security.scan_now'

  // Watcher
  | 'watcher.title' | 'watcher.create' | 'watcher.edit'
  | 'watcher.frequency.daily' | 'watcher.frequency.weekly'
  | 'watcher.frequency.realtime'
  | 'watcher.notification.email' | 'watcher.notification.webhook'
  | 'watcher.status.active' | 'watcher.status.paused'
  | 'watcher.status.error'
  | 'watcher.no_watchers'

  // Docs
  | 'docs.title' | 'docs.sidebar.getting_started'
  | 'docs.sidebar.api_reference' | 'docs.sidebar.guides'
  | 'docs.sidebar.tutorials' | 'docs.sidebar.integration'
  | 'docs.search_placeholder' | 'docs.edit_page'
  | 'docs.last_updated' | 'docs.on_this_page'

  // Pricing page
  | 'pricing.page_title' | 'pricing.subtitle'
  | 'pricing.monthly' | 'pricing.yearly' | 'pricing.save'
  | 'pricing.free_tier_label' | 'pricing.free_tier_desc'
  | 'pricing.paid_tier_note'

  // Contact
  | 'contact.title' | 'contact.name' | 'contact.email'
  | 'contact.subject' | 'contact.message' | 'contact.submit'
  | 'contact.success' | 'contact.error'
  | 'contact.response_time'

  // Signup
  | 'signup.title' | 'signup.email' | 'signup.password'
  | 'signup.confirm_password' | 'signup.name'
  | 'signup.agree_terms' | 'signup.submit'
  | 'signup.oauth.google' | 'signup.oauth.github'
  | 'signup.success.title' | 'signup.success.message'
  | 'signup.already_account' | 'signup.login_link'
  | 'signup.no_account' | 'signup.register_link'

  // Privacy & Terms
  | 'privacy.title' | 'privacy.last_updated'
  | 'privacy.french_version_pending'
  | 'terms.title' | 'terms.last_updated'
  | 'terms.french_version_pending'

  // Status page
  | 'status.title' | 'status.operational' | 'status.degraded'
  | 'status.outage' | 'status.maintenance'
  | 'status.subscribe' | 'status.all_systems'
  | 'status.component.api' | 'status.component.mcp'
  | 'status.component.portal' | 'status.component.database'
  | 'status.component.ai_gateway'

  // 404
  | '404.title' | '404.message' | '404.go_home'
  | '404.contact_support' | '404.search_suggestion'

  // Blog
  | 'blog.title' | 'blog.read_more' | 'blog.filter_all'
  | 'blog.filter_announcements' | 'blog.filter_product'
  | 'blog.filter_tutorial' | 'blog.published_on' | 'blog.by'

  // Changelog
  | 'changelog.title' | 'changelog.version'
  | 'changelog.view_full' | 'changelog.new' | 'changelog.fixed'
  | 'changelog.changed'

  // API Explorer
  | 'api_explorer.title' | 'api_explorer.try_it'
  | 'api_explorer.code_samples' | 'api_explorer.curl'
  | 'api_explorer.python' | 'api_explorer.typescript'
  | 'api_explorer.response' | 'api_explorer.parameters'
  | 'api_explorer.schema' | 'api_explorer.request_duration'
  | 'api_explorer.base_url'

  // Ask/AI
  | 'ask.title' | 'ask.placeholder' | 'ask.suggested'
  | 'ask.model_select' | 'ask.source' | 'ask.disclaimer_ai'

  // Signal
  | 'signal.title' | 'signal.type.political'
  | 'signal.type.corporate' | 'signal.type.regulatory'
  | 'signal.type.judicial' | 'signal.type.electoral'
  | 'signal.severity.high' | 'signal.severity.medium'
  | 'signal.severity.low' | 'signal.severity.info'
  | 'signal.timeline' | 'signal.export' | 'signal.no_signals'

  // Explorer
  | 'explorer.title' | 'explorer.category' | 'explorer.module'
  | 'explorer.search' | 'explorer.pagination.prev'
  | 'explorer.pagination.next' | 'explorer.pagination.page'
  | 'explorer.source_type' | 'explorer.jurisdiction'

  // Citation
  | 'citation.title' | 'citation.format.apa'
  | 'citation.format.mla' | 'citation.format.chicago'
  | 'citation.export' | 'citation.copy' | 'citation.share'
  | 'citation.source' | 'citation.accessed'

  // Agents
  | 'agents.title' | 'agents.type.data' | 'agents.type.search'
  | 'agents.type.monitor' | 'agents.type.analysis'
  | 'agents.status.online' | 'agents.status.offline'
  | 'agents.status.error' | 'agents.status.idle'

  // Workspace
  | 'workspace.title' | 'workspace.settings'
  | 'workspace.members' | 'workspace.integration'
  | 'workspace.billing' | 'workspace.api_keys'
  | 'workspace.name' | 'workspace.description'
  | 'workspace.invite_member' | 'workspace.remove_member'

  // API Error codes
  | 'server.internal_error' | 'server.not_found'
  | 'server.method_not_allowed' | 'server.service_unavailable'
  | 'server.rate_limited'
  | 'auth.key_not_found' | 'auth.key_expired'
  | 'auth.unauthorized' | 'auth.forbidden'
  | 'auth.invalid_token' | 'auth.registration_closed'
  | 'auth.invalid_credentials' | 'auth.account_locked'
  | 'auth.email_taken'
  | 'billing.insufficient_credits' | 'billing.order_not_found'
  | 'billing.payment_failed'
  | 'extraction.source_not_found' | 'extraction.already_cached'
  | 'validation.required' | 'validation.invalid_format'
  | 'validation.too_long' | 'validation.too_short'
  // Quota (freemium — 1000 calls/month then x402)
  | 'quota.title' | 'quota.subtitle' | 'quota.used' | 'quota.remaining'
  | 'quota.percent' | 'quota.reset'
  | 'quota.exceeded.title' | 'quota.exceeded.body' | 'quota.exceeded.cta';

export type TranslationMap = Record<TranslationKeys, string>;

export interface AppI18n {
  lang: Locale;
  t: (key: TranslationKeys, fallbackLang?: Locale) => string;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date | string, style?: 'short' | 'long') => string;
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string;
}
