# Activation refresh and registration repair — 2.0.2

## Findings and evidence

Current unauthenticated workstation probes of https://proforma.rayztechnology.com returned:

| Action | Endpoint | HTTP status | Content-Type | Observed source |
|---|---|---|---|---|
| Refresh account/payment status | GET /api/account | 403 | application/json | Imunify360 block message |
| Device possession challenge | POST /api/challenges | 403 | application/json | Imunify360 block message |
| Register company | POST /api/companies | 403 | application/json | Imunify360 block message |

The POST probes used empty JSON and no credentials, so they did not create challenges, companies, payments or entitlements. A registration attempt normally calls /api/challenges before /api/companies; if that first call is blocked, the registration POST is never sent by the app. These are workstation measurements, not a captured HTTP trace from the customer's phone. The new app exposes method/path/status/content type and Laravel request ID to diagnose phone failures.

The supplied older production log is MissingAppKeyException at 2026-10-20 17:00:07, from before the administrator panel worked. It does not establish the cause of the later generic registration Server Error. The only available local Laravel log is an older local RSA generation error. No current remote registration log has been provided; a fresh production.ERROR entry is still required to establish that separate root cause. No claim is made that every failure is caused by Imunify360.

## App changes

- Classify hosting JSON blocks, HTML challenges (including HTTP 200), invalid/non-JSON responses, Laravel JSON service errors and network failures separately. Do not display raw HTML or server stack/SQL details. Include safe request metadata and request ID. Hosting failures do not erase an authentication token; Laravel JSON 401 does.
- Failed account/settings fetch shows a service/connection error and Retry. Show the fee-unconfigured message only after a successful fetch confirms disabled settings; hide stale payment instructions on failed refresh.
- Approved unused entitlements open first-time company registration after successful refresh. Existing local businesses retain explicit linking/recovery choices. Selecting a new approved company still opens the registration form.
- Preserve registration form state on failed refresh and submission. Persist the owner-scoped company draft, original company ID, selected permanent logo URI, VAT confirmation and pending entitlement ID in local SQLite settings. Do not put licence tokens or entitlement authority in business backups.
- Retries obtain a new single-use possession challenge, reuse the original company/entitlement assignment, accept the canonical server profile, and validate its device-bound signed licence and legal identity before saving activation locally.
- Already activated devices open the workspace using native offline verification even when account refresh fails. Copied records and invalid licences remain blocked.

## Backend changes

- Preserve transactional registration and entitlement row locks plus unique company/entitlement and device/company constraints. Fresh-proof retries for the same owner/company/device converge to the same company and licence ID and return the canonical profile. Different company IDs or legal identities cannot reuse that entitlement.
- Missing/unreadable/invalid RSA signing configuration returns JSON 503 with safe server logging. Registration, device creation, challenge consumption and activation audit roll back together. Existing approved payment and unused entitlement remain available.
- Unique registration conflicts return JSON 409. Other application failures are not silently relabelled as hosting blocks.
- API errors render as JSON even without an Accept header. Success/error responses receive X-Request-ID; Laravel logs include the same ID, method and endpoint, without adding request bodies, credentials or tokens to context.

## Validation

60 mobile tests passed (34 core and 26 Android UI/integration), including HTML/JSON block detection, token retention, failed settings fetch, approval routing, preserved form/logo, restart recovery, lost-response retry, fresh challenges and offline access. PHP 8.2 backend tests: 33 tests / 209 assertions. Four targeted PHP feature tests also passed against a fresh MySQL 8.4/InnoDB database (50 assertions), including rollback after signing failure and successful lost-response retry. Independent MySQL 8.4/InnoDB processes confirmed that concurrent same-company retries converge and competing company IDs cannot consume one entitlement twice. The local WAMP backend was updated after a source backup; an unauthenticated /api/account returns JSON 401 with X-Request-ID. No live account or business data was modified.

## Hosting action — required separately

The app cannot bypass Imunify360. Ask the hosting operator to allow legitimate native API traffic without browser JavaScript/CAPTCHA challenges for proforma.rayztechnology.com. The vendor documents the server-operator command `imunify360-agent whitelist domain add proforma.rayztechnology.com`; the provider must choose the appropriate scoped configuration and retain applicable WAF/rate-limit controls. If a path-scoped exception is supported on the installed version, cover /api/ including account, challenges, companies, recovery, login and payments, rather than exempting only registration. A single phone-IP allowlist is inadequate for users on changing mobile networks. Do not spoof browser headers, disable TLS checks, weaken application authentication/approval, or disable security server-wide.

Vendor references:
- https://cloudlinux.zendesk.com/hc/en-us/articles/360017069879-How-to-disable-WebShield-for-a-domain
- https://docs.imunify360.com/features/#anti-bot-protection

After the exception, unauthenticated probes should reach Laravel and return JSON 401 (with X-Request-ID after this patch), rather than an Imunify block. Then test using the already approved customer's existing account. Do not take another payment to retry. If registration still fails, correlate the displayed request ID with the latest Laravel log entry. Check the configured signing PEM exists, is readable by PHP, has an allowed open_basedir path, and matches the Android verification key. Keep APP_KEY unchanged.

## Install the backend patch using File Manager

1. Back up the four existing files below (the middleware is new). Keep backups outside public_html. The local pre-update WAMP source was backed up separately.
2. Extract the contents of backend/ in Proforma-Backend-Activation-Fix-2.0.2.zip into the private Laravel root: /home/rayzteyi/domains/proforma.rayztechnology.com/proforma-app. Preserve relative directories:
   - app/Http/Controllers/LicenseController.php
   - app/Http/Middleware/ApiRequestContext.php
   - app/Services/LicenseSigner.php
   - bootstrap/app.php
3. Do not upload the patch into public_html. Do not replace .env, vendor, licence keys or storage. No migration, SQL import, administrator recreation or payment reset is needed.
4. Ask hosting support to reset PHP OPcache for the domain if old PHP code remains cached. Cached configuration can be cleared by removing only bootstrap/cache/config.php if it exists; retain the existing .env and APP_KEY.
5. Install the 2.0.2 signed APK over the current app after exporting a business backup. Keep the app installed so its Keystore identity and business records remain intact.

## Remaining live checks

The fresh production registration error is unverified until its log is supplied. The Imunify exception has not been applied by this agent. Real phone payment-approval-to-registration, native hardware Keystore behavior, airplane-mode invoice/PDF use and reconnect/retry must be accepted on a physical device after hosting is corrected. Desktop mocked native tests and successful APK builds do not establish those hardware properties.

## Delivered artifacts

Expo build 6e12ead9-ec6c-4026-9171-1370572dd7d5 finished successfully. The downloaded 2.0.2 APK is 92125455 bytes, version code 5, with verified v2 signature/content digest and the same signing certificate as the existing free release. Its compiled bundle contains the live API URL, persistent registration draft and new error diagnostics. APK SHA-256: c2b0954210b4142bd23720ced9172a6232314ac5320a2740b94b66ad3b0bc6e5. Evidence: artifacts/apk-verification-2.0.2.json.

The backend patch is prepared locally and applied to local WAMP only; it has not been uploaded to production. No database schema or production records were changed. The hosting API exception remains required.
