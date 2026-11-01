package com.docutrust.infra;

import com.codahale.metrics.MetricRegistry;
import com.codahale.metrics.Timer;

// Dropwizard Metrics registry shared by the router (per-route latency timers + request
// counters) and the health endpoint (aggregates surfaced on /api/meta). One static registry
// keeps every measurement in the same namespace without wiring a registry through DI.
public final class Metrics {
    public static final MetricRegistry REGISTRY = new MetricRegistry();

    private Metrics() { }

    /** Times one request for a route pattern (e.g. "POST /api/auth/login") and counts it. */
    public static Timer.Context route(String method, String pattern) {
        REGISTRY.meter(MetricRegistry.name("requests", method + " " + pattern)).mark();
        return REGISTRY.timer(MetricRegistry.name("latency", method + " " + pattern)).time();
    }

    public static long requestsTotal() {
        return REGISTRY.getMeters().values().stream().mapToLong(m -> m.getCount()).sum();
    }

    /** Mean of the per-route mean latencies, weighted by call count (ms). */
    public static long meanLatencyMs() {
        double weighted = 0, total = 0;
        for (Timer t : REGISTRY.getTimers().values()) {
            double n = t.getCount();
            if (n == 0) continue;
            weighted += t.getSnapshot().getMean() * n;
            total += n;
        }
        return total == 0 ? 0 : Math.round(weighted / total);
    }
}
