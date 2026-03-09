# Environment configuration

1. Register custom URL schemes for OAuth redirects in your iOS target:
   - `com.your.bundle` should handle `/oauth2redirect/google` and `/oauth2redirect/openai`.
2. Create the Gemini OAuth client in Google Cloud Console.
   - Authorized redirect URI: `com.your.bundle:/oauth2redirect/google`
3. If you proxy OpenAI, configure matching redirect + client credentials there.
4. Copy `.env.sample` to `.env` and populate secrets before building the app.
