package com.docutrust.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;

import com.docutrust.util.Text;

// Loads configuration: system properties > environment > optional .env file in the working directory.
public final class Config {
    private final java.util.Map<String, String> file;
    public final int port;
    public final String dbUrl, dbUser, dbPassword, jwtSecret, vaultKey, vaultDir, corsOrigin, migrationsDir, dbSchema;
    public final boolean seedDemo;
    // OTP mail delivery (Brevo) + optional Sentry Spotlight profiling.
    public final String mailMode, brevoApiKey, brevoSenderEmail, brevoSenderName;
    public final boolean spotlightEnabled;

    // E-3: HS256 needs >=256 bits of key material; the .env.example placeholder must never reach runtime.
    private static final int MIN_JWT_SECRET_LENGTH = 32;
    private static final java.util.Set<String> JWT_SECRET_PLACEHOLDERS =
            java.util.Set.of("change-me-to-a-long-random-string");

    private Config(java.util.Map<String, String> file) {
        this.file = file;
        port = Integer.parseInt(getOrDefault("PORT", "8080"));
        dbUrl = get("DB_URL");
        dbUser = get("DB_USER");
        dbPassword = get("DB_PASSWORD");
        String js = get("JWT_SECRET");
        if (js == null) {
            js = Text.randomUrl(48);
            System.out.println("[config] JWT_SECRET not set - generated ephemeral secret (tokens will not survive restarts)");
        }
        jwtSecret = js;
        validateJwtSecret(js);
        vaultDir = getOrDefault("VAULT_DIR", "./data/vault"); // moved up: VAULT_KEY gate below needs the dir
        String vk = get("VAULT_KEY");
        if (vk == null) {
            if (vaultHasFiles(vaultDir)) {
                System.err.println("VAULT_KEY is unset but vault contains existing files. Refusing to start (this prevents fabricating tamper evidence). Set VAULT_KEY or use an empty VAULT_DIR.");
                System.exit(1);
            }
            if (!"true".equalsIgnoreCase(get("ALLOW_EPHEMERAL_VAULT"))) {
                System.err.println("[config] VAULT_KEY is unset, vault is empty, and ALLOW_EPHEMERAL_VAULT is not true. Set VAULT_KEY (44-char base64, 32 bytes), or set ALLOW_EPHEMERAL_VAULT=true to run with a throwaway key (vault files will NOT survive a restart).");
                System.exit(1);
            }
            byte[] k = new byte[32];
            new SecureRandom().nextBytes(k);
            vk = Text.b64(k);
            System.out.println("[config] VAULT_KEY not set - generated ephemeral key (ALLOW_EPHEMERAL_VAULT=true); vault files will NOT decrypt after restart");
        }
        vaultKey = vk;
        validateVaultKeyFormat(vaultKey);
        corsOrigin = getOrDefault("CORS_ORIGIN", "*");
        migrationsDir = getOrDefault("MIGRATIONS_DIR", "../database/migrations");
        dbSchema = get("DB_SCHEMA"); // optional: isolate migrations in a throwaway schema (used by tests)
        seedDemo = !"false".equalsIgnoreCase(getOrDefault("SEED_DEMO", "true"));
        if (seedDemo && dbUrl != null && !isLocalDbUrl(dbUrl)) {
            System.err.println("SEED_DEMO=true is only permitted with a localhost database. Demo credentials are in source control.");
            System.exit(1);
        }
        mailMode = getOrDefault("MAIL_MODE", "dev");
        brevoApiKey = get("BREVO_API_KEY");
        brevoSenderEmail = get("BREVO_SENDER_EMAIL");
        brevoSenderName = getOrDefault("BREVO_SENDER_NAME", "DocuTrust");
        // Fail fast: live mode with no credentials would strand every OTP request at send time.
        if ("live".equalsIgnoreCase(mailMode) && (brevoApiKey == null || brevoApiKey.isBlank()
                || brevoSenderEmail == null || brevoSenderEmail.isBlank())) {
            System.err.println("MAIL_MODE=live requires BREVO_API_KEY and BREVO_SENDER_EMAIL (or set MAIL_MODE=dev for the console/X-Dev-OTP delivery).");
            System.exit(1);
        }
        spotlightEnabled = "true".equalsIgnoreCase(get("SPOTLIGHT_ENABLED"));
    }

    public static Config load() {
        java.util.Map<String, String> f = new java.util.HashMap<>();
        Path p = Path.of(".env");
        if (Files.exists(p)) {
            try {
                for (String line : Files.readAllLines(p)) {
                    line = line.trim();
                    if (line.isEmpty() || line.startsWith("#")) continue;
                    int eq = line.indexOf('=');
                    if (eq > 0) f.put(line.substring(0, eq).trim(), unquote(line.substring(eq + 1).trim()));
                }
            } catch (IOException ignored) { }
        }
        return new Config(f);
    }

    private static String unquote(String v) {
        if (v.length() >= 2 && ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))))
            return v.substring(1, v.length() - 1);
        return v;
    }

    /** True if the vault directory exists and contains at least one regular file at any depth. */
    private static boolean vaultHasFiles(String dir) {
        try {
            Path p = Path.of(dir);
            if (!Files.isDirectory(p)) return false;
            try (var stream = Files.walk(p)) {
                return stream.anyMatch(f -> Files.isRegularFile(f));
            }
        } catch (Exception e) {
            return true; // cannot inspect the vault: fail closed (covers UncheckedIOException, InvalidPathException)
        }
    }

    /**
     * Extracts the host from a JDBC URL; true only for localhost / 127.0.0.1.
     * Unparseable or host-less URLs count as non-local (fail closed).
     */
    public static boolean isLocalDbUrl(String url) {
        if (url == null) return false;
        int i = url.indexOf("//");
        if (i < 0) return false; // e.g. jdbc:postgresql:dbname - host not explicit, refuse
        String rest = url.substring(i + 2);
        int slash = rest.indexOf('/');
        if (slash >= 0) rest = rest.substring(0, slash);
        int at = rest.lastIndexOf('@');
        if (at >= 0) rest = rest.substring(at + 1); // strip userinfo
        int colon = rest.indexOf(':');
        if (colon >= 0) rest = rest.substring(0, colon); // strip :port
        return "localhost".equals(rest) || "127.0.0.1".equals(rest);
    }

    /** E-3: a short or placeholder JWT secret makes HS256 tokens forgeable - refuse to start. */
    private static void validateJwtSecret(String secret) {
        if (secret.length() < MIN_JWT_SECRET_LENGTH || JWT_SECRET_PLACEHOLDERS.contains(secret)) {
            System.err.println("JWT_SECRET must be at least " + MIN_JWT_SECRET_LENGTH
                    + " characters and must not be a placeholder (got " + secret.length() + " chars). Generate one with: openssl rand -base64 48");
            System.exit(1);
        }
    }

    /**
     * D-1: accepts ONLY a 44-character base64 string that decodes to exactly 32 bytes.
     * Runs at config load - BEFORE database connections and migrations - so a bad key fails fast.
     * KNOWN LIMITATION: vaults previously encrypted under a passphrase-derived key
     * (SHA-256(passphrase)) will NOT decrypt after the passphrase path was removed -
     * affected deployments must re-encrypt or start with a fresh VAULT_DIR. Accepted
     * breakage: student project, no production data.
     */
    public static void validateVaultKeyFormat(String key) {
        if (key != null && key.length() == 44) {
            try {
                if (Text.b64decode(key).length == 32) return;
            } catch (Exception ignored) { }
        }
        System.err.println("VAULT_KEY must be a 44-character base64 string encoding exactly 32 bytes (see .env.example). Passphrase-derived keys are no longer accepted (D-1).");
        System.exit(1);
    }

    private String get(String key) {
        String v = System.getProperty(key);
        if (v != null && !v.isBlank()) return v;
        v = System.getenv(key);
        if (v != null && !v.isBlank()) return v;
        return file.get(key);
    }

    private String getOrDefault(String key, String dflt) {
        String v = get(key);
        return v == null ? dflt : v;
    }
}
