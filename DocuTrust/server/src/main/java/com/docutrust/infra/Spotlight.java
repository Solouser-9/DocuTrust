package com.docutrust.infra;

import com.docutrust.config.Config;

// Optional Sentry integration for local profiling: with SPOTLIGHT_ENABLED=true, events and
// traces stream to a Spotlight sidecar on localhost:8969 (https://spotlightjs.com) during
// development. Default OFF - production builds ship with no telemetry egress at all.
public final class Spotlight {
    private Spotlight() { }

    public static void init(Config cfg) {
        if (!cfg.spotlightEnabled) return;
        try {
            io.sentry.Sentry.init(options -> {
                options.setDsn("http://key@localhost:8969/stream");
                options.setEnvironment("spotlight");
                options.setTracesSampleRate(1.0);
            });
            System.out.println("[spotlight] Sentry tracing enabled -> localhost:8969 (Spotlight sidecar)");
        } catch (Exception e) {
            System.err.println("[spotlight] init failed (continuing without telemetry): " + e.getMessage());
        }
    }
}
