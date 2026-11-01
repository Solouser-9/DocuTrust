package com.docutrust.test;

import com.docutrust.auth.PasswordService;

public class PasswordServiceTest {

    @DocuTest
    public void hashThenVerifyOk() {
        PasswordService pw = new PasswordService();
        String stored = pw.hash("S3cret-pass");
        A.isTrue(stored.startsWith("pbkdf2$"));
        A.isTrue(pw.verify("S3cret-pass", stored));
    }

    @DocuTest
    public void wrongPasswordFails() {
        PasswordService pw = new PasswordService();
        String stored = pw.hash("S3cret-pass");
        A.isFalse(pw.verify("s3cret-PASS", stored));
        A.isFalse(pw.verify("", stored));
        A.isFalse(pw.verify(null, stored));
    }

    @DocuTest
    public void saltsAreUnique() {
        PasswordService pw = new PasswordService();
        String a = pw.hash("same-password");
        String b = pw.hash("same-password");
        A.notEq(a, b);
        A.isTrue(pw.verify("same-password", a));
        A.isTrue(pw.verify("same-password", b));
    }

    @DocuTest
    public void malformedStoredHashIsRejected() {
        PasswordService pw = new PasswordService();
        A.isFalse(pw.verify("x", ""));
        A.isFalse(pw.verify("x", "garbage"));
        A.isFalse(pw.verify("x", "pbkdf2$abc$def$ghi"));
    }
}
