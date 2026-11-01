package com.docutrust.test;

import java.util.Objects;

// Tiny assertion helpers; every failure is an AssertionError with a helpful message.
public final class A {
    private A() {}

    public static void eq(Object expected, Object actual) {
        if (!Objects.equals(expected, actual))
            throw new AssertionError("expected <" + expected + "> but was <" + actual + ">");
    }

    public static void notEq(Object unexpected, Object actual) {
        if (Objects.equals(unexpected, actual))
            throw new AssertionError("expected value different from <" + unexpected + "> but got the same");
    }

    public static void isTrue(boolean cond) {
        if (!cond) throw new AssertionError("expected true but was false");
    }

    public static void isFalse(boolean cond) {
        if (cond) throw new AssertionError("expected false but was true");
    }

    public static void notNull(Object o) {
        if (o == null) throw new AssertionError("expected non-null value");
    }

    public static void isNull(Object o) {
        if (o != null) throw new AssertionError("expected null but was <" + o + ">");
    }

    public static void contains(String needle, String haystack) {
        if (haystack == null || !haystack.contains(needle))
            throw new AssertionError("expected <" + haystack + "> to contain <" + needle + ">");
    }

    public static void startsWith(String prefix, String s) {
        if (s == null || !s.startsWith(prefix))
            throw new AssertionError("expected <" + s + "> to start with <" + prefix + ">");
    }

    public static void endsWith(String suffix, String s) {
        if (s == null || !s.endsWith(suffix))
            throw new AssertionError("expected <" + s + "> to end with <" + suffix + ">");
    }

    public static void between(long lowInclusive, long value, long highInclusive) {
        if (value < lowInclusive || value > highInclusive)
            throw new AssertionError("expected " + value + " to be between " + lowInclusive + " and " + highInclusive);
    }

    public interface Thunk { void run() throws Exception; }

    public static void throwsA(Class<? extends Throwable> expected, Thunk thunk) {
        try {
            thunk.run();
        } catch (Throwable t) {
            if (expected.isInstance(t)) return;
            throw new AssertionError("expected " + expected.getSimpleName() + " but got " + t.getClass().getName() + ": " + t);
        }
        throw new AssertionError("expected " + expected.getSimpleName() + " but nothing was thrown");
    }

    public static void throwsA(Class<? extends Throwable> expected, String messagePart, Thunk thunk) {
        try {
            thunk.run();
        } catch (Throwable t) {
            if (!expected.isInstance(t))
                throw new AssertionError("expected " + expected.getSimpleName() + " but got " + t.getClass().getName() + ": " + t);
            if (messagePart != null && (t.getMessage() == null || !t.getMessage().contains(messagePart)))
                throw new AssertionError("expected message containing <" + messagePart + "> but was <" + t.getMessage() + ">");
            return;
        }
        throw new AssertionError("expected " + expected.getSimpleName() + " but nothing was thrown");
    }
}
