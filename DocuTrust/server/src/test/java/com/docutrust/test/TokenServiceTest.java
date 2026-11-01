package com.docutrust.test;

import com.docutrust.auth.TokenService;
import com.docutrust.util.Text;

public class TokenServiceTest {

    @DocuTest
    public void tokensAre43CharUrlSafe() {
        for (int i = 0; i < 25; i++) {
            String t = TokenService.newToken();
            A.eq(43, t.length());
            A.isTrue(TokenService.validFormat(t));
            A.isTrue(t.matches("[A-Za-z0-9_\\-]{43}"));
        }
        A.notEq(TokenService.newToken(), TokenService.newToken());
    }

    @DocuTest
    public void formatValidationIsStrict() {
        A.isFalse(TokenService.validFormat(null));
        A.isFalse(TokenService.validFormat(""));
        A.isFalse(TokenService.validFormat("a".repeat(42)));
        A.isFalse(TokenService.validFormat("a".repeat(44)));
        A.isFalse(TokenService.validFormat("a".repeat(42) + "+"));
        A.isFalse(TokenService.validFormat("a".repeat(42) + "/"));
        A.isTrue(TokenService.validFormat("a".repeat(43)));
    }

    @DocuTest
    public void hashIsStableSha256Hex() {
        String h1 = TokenService.hash("token-value");
        String h2 = TokenService.hash("token-value");
        A.eq(h1, h2);
        A.eq(64, h1.length());
        A.isTrue(h1.matches("[0-9a-f]{64}"));
        A.eq(Text.sha256Hex("token-value".getBytes()), h1);
        A.notEq(h1, TokenService.hash("other-value"));
    }

    @DocuTest
    public void differentTokensNeverCollide() {
        A.notEq(TokenService.hash(TokenService.newToken()), TokenService.hash(TokenService.newToken()));
    }
}
