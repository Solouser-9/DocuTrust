package com.docutrust.util;

import java.util.regex.Pattern;

import com.docutrust.AppException;

// Field-level validation helpers; every failure throws AppException(400 VALIDATION_ERROR) with the field name.
public final class Validator {
    private static final Pattern EMAIL = Pattern.compile("^[A-Za-z0-9+_.\\-]+@[A-Za-z0-9\\-]+(\\.[A-Za-z0-9\\-]+)+$");

    private Validator() {}

    public static String email(String v) {
        String s = required(v, "email", 255).toLowerCase();
        if (!EMAIL.matcher(s).matches()) throw AppException.validation("email", "Email is not valid");
        return s;
    }

    public static String password(String v) {
        if (v == null || v.length() < 8 || !v.matches(".*[A-Z].*") || !v.matches(".*[a-z].*") || !v.matches(".*[0-9].*"))
            throw AppException.validation("password", "Password needs 8+ characters with an uppercase, a lowercase and a digit");
        return v;
    }

    public static String required(String v, String field, int max) {
        if (v == null || v.isBlank()) throw AppException.validation(field, field + " is required");
        String s = v.trim();
        if (s.length() > max) throw AppException.validation(field, field + " must be at most " + max + " characters");
        return s;
    }

    public static String optional(String v, String field, int max) {
        if (v == null || v.isBlank()) return null;
        return required(v, field, max);
    }

    public static String oneOf(String v, String field, String... allowed) {
        String s = required(v, field, 80);
        for (String a : allowed) if (a.equals(s)) return s;
        throw AppException.validation(field, field + " must be one of: " + String.join(", ", allowed));
    }

    public static int intRange(Integer v, String field, int min, int max, int dflt) {
        if (v == null) return dflt;
        if (v < min || v > max) throw AppException.validation(field, field + " must be between " + min + " and " + max);
        return v;
    }
}
