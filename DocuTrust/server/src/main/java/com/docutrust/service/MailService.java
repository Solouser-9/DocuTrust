package com.docutrust.service;

import com.docutrust.AppException;
import com.docutrust.config.Config;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

// Email delivery via the Brevo transactional API. MAIL_MODE=live posts to api.brevo.com;
// MAIL_MODE=dev (the default) never touches the network - the code is logged and surfaced
// to the caller via the X-Dev-OTP response header so demos and the e2e suite stay testable.
public final class MailService {
    private static final String BREVO_URL = "https://api.brevo.com/v3/smtp/email";

    private final String mode, apiKey, senderEmail, senderName;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public MailService(Config cfg) {
        this.mode = cfg.mailMode;
        this.apiKey = cfg.brevoApiKey;
        this.senderEmail = cfg.brevoSenderEmail;
        this.senderName = cfg.brevoSenderName;
    }

    public boolean devMode() { return !"live".equalsIgnoreCase(mode); }

    /** Sends one email. Throws 502 when live mode fails - a silently dropped OTP would lock users out. */
    public void send(String toEmail, String subject, String textBody) {
        if (devMode()) {
            System.out.println("[mail:dev] to=" + toEmail + " subject=\"" + subject + "\" body=" + textBody);
            return;
        }
        try {
            String payload = com.docutrust.util.Json.write(com.docutrust.util.Json.obj(
                    "sender", com.docutrust.util.Json.obj("name", senderName, "email", senderEmail),
                    "to", new Object[]{com.docutrust.util.Json.obj("email", toEmail)},
                    "subject", subject,
                    "textContent", textBody));
            HttpRequest req = HttpRequest.newBuilder(URI.create(BREVO_URL))
                    .timeout(Duration.ofSeconds(15))
                    .header("api-key", apiKey)
                    .header("content-type", "application/json")
                    .header("accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() < 200 || res.statusCode() >= 300)
                throw new AppException(502, "MAIL_SEND_FAILED", "Email provider rejected the message (HTTP " + res.statusCode() + ")");
        } catch (AppException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AppException(502, "MAIL_SEND_FAILED", "Email delivery was interrupted");
        } catch (Exception e) {
            throw new AppException(502, "MAIL_SEND_FAILED", "Email delivery failed: " + e.getMessage());
        }
    }

    public void sendOtp(String toEmail, String purpose, String code, long ttlMinutes) {
        String friendly = switch (purpose) {
            case "password_reset" -> "reset your password";
            case "mfa_login" -> "finish signing in";
            case "step_up" -> "confirm this sensitive action";
            case "share_access" -> "open the shared document";
            default -> "continue";
        };
        send(toEmail, "Your DocuTrust verification code",
                "Your DocuTrust code to " + friendly + " is: " + code + "\n\n"
                        + "It expires in " + ttlMinutes + " minutes and can be used once. "
                        + "If you did not request this, ignore this email - nothing changes without the code.");
    }
}
