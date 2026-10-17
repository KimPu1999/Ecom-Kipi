# THANGPC Google Sign-In

Google Sign-In uses Google Identity Services in `apps/web` and sends the returned ID token to Laravel at `POST /api/v1/auth/google`. Laravel verifies the token with `google/apiclient`, then returns the same Sanctum personal access token response used by password login.

## Google Cloud Console

1. Open [Google Cloud Console credentials](https://console.cloud.google.com/apis/credentials) and select the project for THANGPC.
2. Configure the OAuth consent screen with the application name and support information required by Google.
3. Create an OAuth 2.0 Client ID with application type **Web application**.
4. Add each customer storefront origin to **Authorized JavaScript origins**. For local development this is normally `http://localhost:5173`. Add the production HTTPS origin separately.
5. This implementation uses the Google Identity Services popup button, so it does not use a Google redirect callback URL. The application callback is the JavaScript credential callback followed by `POST /api/v1/auth/google`.

## Environment variables

Use the same OAuth client ID in both applications:

```dotenv
# apps/web/.env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# backend/laravel-api/.env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

`VITE_GOOGLE_CLIENT_ID` is public browser configuration. Do not put a Google client secret in any Vite variable, source file, or committed environment file. This flow does not require a client secret.

Restart Vite and Laravel after changing environment files. Existing CORS configuration already permits the local customer origin and `withCredentials` remains enabled on the shared API client.

## Account-linking policy

- Laravel verifies the Google signature, issuer, audience, expiration, subject, email format, and `email_verified` claim before using any identity fields.
- The verified, lower-case email is matched case-insensitively against the existing unique `users.email` value to prevent duplicate accounts.
- A new account receives only the `customer` role and an unusable random password; it never receives admin or seller privileges.
- Existing inactive or staff accounts are rejected on the customer Google endpoint. Staff must continue using their existing staff sign-in.
- Existing customer accounts are reused and marked email-verified after Google proves control of the same verified email address.

## Local verification

With both environment variables configured and the API/frontend running:

1. Open `http://localhost:5173/login` or `/register`.
2. Select **Continue with Google** and complete the Google popup.
3. Confirm the customer is redirected to `/account` and receives the existing authenticated customer experience.
4. Close the popup or use an invalid/cancelled attempt to confirm the email/password form remains available and errors remain inline.

The backend test suite includes mocked Google identity tests for new customer creation, case-insensitive account reuse, staff rejection, and invalid-token rejection. Tests never contact Google or use production credentials.
