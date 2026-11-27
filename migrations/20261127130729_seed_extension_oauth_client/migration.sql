-- The Chrome extension's OAuth client (src/lib/extension.ts): public (PKCE, no secret), first party
-- (no consent screen: only this extension can receive its chromiumapp.org redirect), and allowed
-- access tokens for the app's API. The resource is also seeded at boot by the `resources` option;
-- it's inserted here too because the client's link to it needs the row.
INSERT OR IGNORE INTO `oauth_resource` (`id`, `identifier`, `name`, `disabled`, `policy_version`, `dpop_bound_access_tokens_required`, `created_at`, `updated_at`)
VALUES ('wow-api', 'https://www.wafflehaus.io/api', 'WOW API', 0, 1, 0, 1795784000000, 1795784000000);
--> statement-breakpoint
INSERT OR IGNORE INTO `oauth_client` (`id`, `client_id`, `name`, `disabled`, `skip_consent`, `scopes`, `client_credentials_scopes`, `redirect_uris`, `token_endpoint_auth_method`, `application_type`, `grant_types`, `response_types`, `require_pkce`, `dpop_bound_access_tokens`, `created_at`, `updated_at`)
VALUES ('wow-chrome-extension', 'wow-chrome-extension', 'WOW Chrome extension', 0, 1, '["openid","profile","email","offline_access"]', '[]', '["https://cjlnmohemgdbijeapkgofjndnhphmebd.chromiumapp.org/"]', 'none', 'web', '["authorization_code","refresh_token"]', '["code"]', 1, 0, 1795784000000, 1795784000000);
--> statement-breakpoint
INSERT OR IGNORE INTO `oauth_client_resource` (`id`, `client_id`, `resource_id`, `created_at`)
VALUES ('wow-chrome-extension-api', 'wow-chrome-extension', 'https://www.wafflehaus.io/api', 1795784000000);
