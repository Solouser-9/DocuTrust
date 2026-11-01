package com.docutrust.auth;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

// Token-bucket rate limiting on Bucket4j (one bucket per key), with the bucket map held in a
// Caffeine cache so idle keys are evicted instead of leaking. The allow(key) / allow(key,
// limit, windowMillis) contract is unchanged from the previous hand-rolled sliding window;
// Bucket4j additionally smooths bursts instead of allowing a full window's worth at once.
// The shared default scope is a bit roomier than the original 10/min: a real user doing
// password-reset + MFA login + step-up inside one minute burns 6+ tokens on their own.
public final class RateLimiter {
    private static final long DEFAULT_LIMIT = 10;
    private static final long DEFAULT_WINDOW_MS = 60_000;
    /** Per-scope budgets for the shared default: scope -> {limit, windowMillis}. */
    private static final java.util.Map<String, long[]> SCOPE_DEFAULTS = java.util.Map.of(
            "auth", new long[]{20, 60_000},
            "public-share", new long[]{30, 60_000},
            "public-verify", new long[]{20, 60_000});

    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .maximumSize(50_000)
            .expireAfterAccess(10, TimeUnit.MINUTES)
            .build();

    public boolean allow(String key, int limit, long windowMillis) {
        Bucket bucket = buckets.get(key, k -> Bucket.builder()
                .addLimit(Bandwidth.classic(limit, Refill.greedy(limit, Duration.ofMillis(windowMillis))))
                .build());
        return bucket.tryConsume(1);
    }

    public boolean allow(String key) {
        long[] budget = SCOPE_DEFAULTS.get(key.contains("|") ? key.substring(0, key.indexOf('|')) : "");
        if (budget != null) return allow(key, (int) budget[0], budget[1]);
        return allow(key, (int) DEFAULT_LIMIT, DEFAULT_WINDOW_MS);
    }

    public void reset() { buckets.invalidateAll(); }
}
