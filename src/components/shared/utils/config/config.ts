import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
import brandConfig from '../../../../../brand.config.json';

// =============================================================================
// Constants - Derived from brand.config.json
// =============================================================================

export const CLIENT_ID = '349csAfIXXOmHtj6ys2EG';

// Using domain_name from brand.config.json to ensure consistency
const DEFAULT_REDIRECT_URI = 'https://melennium.vercel.app';

// Production brand domains (a single domain or a list), flattened to an array
const PRODUCTION_HOSTNAMES = ([] as string[]).concat(brandConfig.platform.hostname.production.com);

// On any production brand domain, redirect back to that same origin so OAuth works per domain
// (each origin must be registered as a redirect URI on the Deriv app). Elsewhere, use the default.
const getRedirectUri = () => {
    if (typeof window !== 'undefined' && PRODUCTION_HOSTNAMES.includes(window.location.hostname)) {
        return window.location.origin;
    }
    return DEFAULT_REDIRECT_URI;
};

export const REDIRECT_URI = getRedirectUri();

/**
 * Deriv only accepts the exact redirect URLs registered on the app, and the PKCE verifier lives in
 * per-origin sessionStorage. So a visit to www.<domain> is sent to <domain> (when that apex is a
 * production domain) before any login starts. Returns true when a redirect was triggered.
 */
export const redirectToCanonicalHost = (): boolean => {
    if (typeof window === 'undefined') return false;
    const { hostname, href } = window.location;
    const apex = hostname.replace(/^www\./, '');
    if (apex === hostname || !PRODUCTION_HOSTNAMES.includes(apex)) return false;
    window.location.replace(href.replace(`//${hostname}`, `//${apex}`));
    return true;
};

// Construct WebSocket URLs from platform.derivws config
export const WS_SERVERS = {
    STAGING: `${brandConfig.platform.derivws.url.staging}${brandConfig.platform.derivws.directories.options}ws/public`,
    PRODUCTION: `${brandConfig.platform.derivws.url.production}${brandConfig.platform.derivws.directories.options}ws/public`,
} as const;

// =============================================================================
// Environment Helpers (Hardcoded to Production for Auth)
// =============================================================================

export const isLocal = () => /localhost(:\d+)?$/i.test(window.location.hostname);

// Force production logic to ensure we always use bmtraders.site for OAuth
export const isProduction = () => true;

const getDefaultServerURL = () => {
    return WS_SERVERS.PRODUCTION;
};

export const getSocketURL = async (): Promise<string> => {
    try {
        const authInfo = OAuthTokenExchangeService.getAuthInfo();
        if (!authInfo?.access_token) return getDefaultServerURL();

        // Orchestrates the flow to get authenticated WS URL
        return await DerivWSAccountsService.getAuthenticatedWebSocketURL(authInfo.access_token);
    } catch (error) {
        console.error('[DerivWS] Socket URL Error:', error);
        return getDefaultServerURL();
    }
};

// =============================================================================
// Security Helpers (PKCE & CSRF)
// =============================================================================

const generateSecureString = (length = 32): string => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
};

const generateCodeChallenge = async (verifier: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return btoa(String.fromCharCode(...hashArray))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

export const storeCSRFToken = (token: string) => {
    sessionStorage.setItem('oauth_csrf_token', token);
    sessionStorage.setItem('oauth_csrf_token_timestamp', Date.now().toString());
};

export const validateCSRFToken = (token: string): boolean => {
    const storedToken = sessionStorage.getItem('oauth_csrf_token');
    if (!storedToken) return false;
    // Direct comparison for callback validation
    return storedToken === token;
};

export const clearCSRFToken = () => {
    sessionStorage.removeItem('oauth_csrf_token');
    sessionStorage.removeItem('oauth_csrf_token_timestamp');
};

export const getCodeVerifier = () => sessionStorage.getItem('oauth_code_verifier');

export const clearCodeVerifier = () => {
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_code_verifier_timestamp');
};

// =============================================================================
// OAuth URL Generator
// =============================================================================

export const generateOAuthURL = async (prompt?: string) => {
    try {
        // Pulls https://auth.deriv.com/oauth2/ from brand.config.json
        const authBase = brandConfig.platform.auth2_url.production;
        const authHost = authBase.endsWith('/') ? `${authBase}auth` : `${authBase}/auth`;

        const csrfToken = generateSecureString();
        storeCSRFToken(csrfToken);

        const codeVerifier = generateSecureString();
        const codeChallenge = await generateCodeChallenge(codeVerifier);

        // Store PKCE verifier
        sessionStorage.setItem('oauth_code_verifier', codeVerifier);
        sessionStorage.setItem('oauth_code_verifier_timestamp', Date.now().toString());

        const params = new URLSearchParams({
            scope: 'trade',
            response_type: 'code',
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            state: csrfToken,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        if (prompt) params.append('prompt', prompt);

        // Optional: app_id check
        const appId = '70505';
        if (appId) params.append('app_id', appId);

        const finalUrl = `${authHost}?${params.toString()}`;

        console.log('[OAuth] Production URL:', finalUrl);
        return finalUrl;
    } catch (error) {
        console.error('Error generating OAuth URL:', error);
        return '';
    }
};
