package com.docutrust.test;

import com.docutrust.auth.MfaService;

public class MfaServiceTest {

    private static final MfaService MFA = new MfaService();

    @DocuTest
    public void currentCodeVerifies() {
        String secret = MFA.newSecret();
        long step = System.currentTimeMillis() / 1000 / 30;
        String code = MfaService.codeFor(MfaService.base32Decode(secret), step);
        A.eq(6, code.length());
        A.isTrue(MFA.verify(secret, code));
    }

    @DocuTest
    public void acceptsAdjacentWindow() {
        String secret = MFA.newSecret();
        long step = System.currentTimeMillis() / 1000 / 30;
        A.isTrue(MFA.verify(secret, MfaService.codeFor(MfaService.base32Decode(secret), step - 1)));
        A.isTrue(MFA.verify(secret, MfaService.codeFor(MfaService.base32Decode(secret), step + 1)));
    }

    @DocuTest
    public void wrongCodeFails() {
        String secret = MFA.newSecret();
        long step = System.currentTimeMillis() / 1000 / 30;
        String far = MfaService.codeFor(MfaService.base32Decode(secret), step + 5);
        A.isFalse(MFA.verify(secret, far));
        A.isFalse(MFA.verify(secret, "000000".equals(far) ? "000001" : "000000"));
    }

    @DocuTest
    public void rejectsBadInput() {
        String secret = MFA.newSecret();
        A.isFalse(MFA.verify(secret, null));
        A.isFalse(MFA.verify(secret, "abc"));
        A.isFalse(MFA.verify(secret, "12345"));
        A.isFalse(MFA.verify(secret, "1234567"));
        A.isFalse(MFA.verify(null, "123456"));
        A.isFalse(MFA.verify("!!!not-base32!!!", "123456"));
    }

    @DocuTest
    public void base32RoundTrip() {
        byte[] data = new byte[20];
        for (int i = 0; i < data.length; i++) data[i] = (byte) (i * 13 + 1);
        String enc = MfaService.base32Encode(data);
        A.eq(32, enc.length());
        byte[] back = MfaService.base32Decode(enc);
        A.eq(data.length, back.length);
        for (int i = 0; i < data.length; i++) A.eq((long) data[i], (long) back[i]);
    }

    @DocuTest
    public void otpauthUrlShape() {
        String url = MFA.otpauthUrl("user@x.io", "SECRET234");
        A.contains("otpauth://totp/DocuTrust:user@x.io", url);
        A.contains("secret=SECRET234", url);
        A.contains("issuer=DocuTrust", url);
    }
}
