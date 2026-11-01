package com.docutrust.test;

import com.docutrust.auth.JwtService;

public class JwtServiceTest {

    @DocuTest
    public void roundTripKeepsClaims() {
        JwtService jwt = new JwtService("secret-abc");
        String token = jwt.issue("user-123", "org_manager", "org-9", 900, null);
        JwtService.Claims c = jwt.verify(token);
        A.eq("user-123", c.sub);
        A.eq("org_manager", c.role);
        A.eq("org-9", c.orgId);
        A.isTrue(c.exp > c.iat);
        A.notNull(c.jti);
        A.eq(3, token.split("\\.").length);
    }

    @DocuTest
    public void expiredTokenThrowsExpired() {
        JwtService jwt = new JwtService("secret-abc");
        String token = jwt.issue("user-123", "member", null, -5, null);
        A.throwsA(JwtService.TokenExpiredException.class, token.isEmpty() ? null : "", () -> jwt.verify(token));
    }

    @DocuTest
    public void tamperedSignatureIsRejected() {
        JwtService jwt = new JwtService("secret-abc");
        String token = jwt.issue("user-123", "member", null, 900, null);
        String broken = token.substring(0, token.length() - 2) + "xx";
        A.throwsA(JwtService.TokenInvalidException.class, () -> jwt.verify(broken));
    }

    @DocuTest
    public void wrongSecretIsRejected() {
        JwtService legit = new JwtService("secret-abc");
        JwtService impostor = new JwtService("another-secret");
        String token = legit.issue("user-123", "member", null, 900, null);
        A.throwsA(JwtService.TokenInvalidException.class, () -> impostor.verify(token));
    }

    @DocuTest
    public void malformedTokensAreRejected() {
        JwtService jwt = new JwtService("secret-abc");
        A.throwsA(JwtService.TokenInvalidException.class, () -> jwt.verify(""));
        A.throwsA(JwtService.TokenInvalidException.class, () -> jwt.verify("not-a-jwt"));
        A.throwsA(JwtService.TokenInvalidException.class, () -> jwt.verify("a.b"));
    }
}
