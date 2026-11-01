package com.docutrust.test;

import com.docutrust.AppException;
import com.docutrust.util.Validator;

public class ValidatorTest {

    @DocuTest
    public void emailAcceptsValid() {
        A.eq("user@example.com", Validator.email("User@Example.COM"));
        A.eq("a.b+tag@sub.domain.io", Validator.email("a.b+tag@sub.domain.io"));
    }

    @DocuTest
    public void emailRejectsInvalid() {
        for (String bad : new String[]{"", "   ", null})
            A.throwsA(AppException.class, "required", () -> Validator.email(bad));
        for (String bad : new String[]{"nope", "a@b", "@x.com", "a@.com", "a b@c.com"})
            A.throwsA(AppException.class, "not valid", () -> Validator.email(bad));
    }

    @DocuTest
    public void passwordPolicy() {
        A.eq("Abcdef12", Validator.password("Abcdef12"));
        A.throwsA(AppException.class, "Password needs", () -> Validator.password("short1A"));
        A.throwsA(AppException.class, "Password needs", () -> Validator.password("alllowercase1"));
        A.throwsA(AppException.class, "Password needs", () -> Validator.password("ALLUPPERCASE1"));
        A.throwsA(AppException.class, "Password needs", () -> Validator.password("NoDigitsHere"));
        A.throwsA(AppException.class, "Password needs", () -> Validator.password(null));
    }

    @DocuTest
    public void requiredAndOptional() {
        A.eq("trimmed", Validator.required(" trimmed ", "title", 50));
        A.throwsA(AppException.class, "title", () -> Validator.required("  ", "title", 50));
        A.throwsA(AppException.class, "title", () -> Validator.required(null, "title", 50));
        A.throwsA(AppException.class, "title", () -> Validator.required("x".repeat(51), "title", 50));
        A.eq(null, Validator.optional("  ", "phone", 30));
        A.eq("ok", Validator.optional("ok", "phone", 30));
    }

    @DocuTest
    public void oneOfAndIntRange() {
        A.eq("view", Validator.oneOf("view", "permission", "view", "download"));
        A.throwsA(AppException.class, "permission", () -> Validator.oneOf("execute", "permission", "view", "download"));
        A.throwsA(AppException.class, "permission", () -> Validator.oneOf(null, "permission", "view"));
        A.eq(14, Validator.intRange(null, "reminderDays", 1, 90, 14));
        A.eq(30, Validator.intRange(30, "reminderDays", 1, 90, 14));
        A.throwsA(AppException.class, "reminderDays", () -> Validator.intRange(91, "reminderDays", 1, 90, 14));
        A.throwsA(AppException.class, "reminderDays", () -> Validator.intRange(0, "reminderDays", 1, 90, 14));
    }

    @DocuTest
    public void failuresCarryFieldAndCode() {
        try {
            Validator.email("bad");
            throw new AssertionError("should have thrown");
        } catch (AppException e) {
            A.eq(400, e.status);
            A.eq("VALIDATION_ERROR", e.code);
            A.eq("email", e.field);
        }
    }
}
