package com.docutrust.test;

import java.util.Map;

import com.docutrust.auth.JwtService;
import com.docutrust.auth.RateLimiter;
import com.docutrust.http.Ctx;
import com.docutrust.http.Middleware;
import com.docutrust.http.Router;

public class RouterTest {

    private static Router router() {
        Router r = new Router(null, null, null);
        r.add("GET", "/api/documents", ctx -> { });
        r.add("GET", "/api/documents/:id", ctx -> { });
        r.add("GET", "/api/documents/expiring", ctx -> { });
        r.add("GET", "/api/documents/:id/versions/:v/download", ctx -> { });
        r.add("POST", "/api/documents", ctx -> { });
        return r;
    }

    @DocuTest
    public void paramPatternsCapture() {
        Router.Match m = router().match("GET", "/api/documents/abc-123");
        A.notNull(m);
        A.eq("/api/documents/:id", m.route().pattern);
        A.eq("abc-123", m.params().get("id"));
    }

    @DocuTest
    public void staticSegmentsBeatParams() {
        Router.Match m = router().match("GET", "/api/documents/expiring");
        A.notNull(m);
        A.eq("/api/documents/expiring", m.route().pattern);
        A.isTrue(m.params().isEmpty());
    }

    @DocuTest
    public void nestedParamsCapture() {
        Router.Match m = router().match("GET", "/api/documents/abc/versions/3/download");
        A.notNull(m);
        A.eq("abc", m.params().get("id"));
        A.eq("3", m.params().get("v"));
    }

    @DocuTest
    public void methodMustMatch() {
        A.notNull(router().match("POST", "/api/documents"));
        A.isNull(router().match("POST", "/api/documents/abc"));
        A.isNull(router().match("GET", "/api/unknown"));
        A.isNull(router().match("GET", "/api/documents/abc/extra"));
    }

    @DocuTest
    public void helpersWireMiddlewareChain() {
        // wrap-time only builds lambdas; the DB is touched at handle-time, so null db is fine here
        Middleware mw = new Middleware(null, new JwtService("router-test"), new RateLimiter());
        Router r = new Router(null, null, mw);
        r.publicRoute("GET", "/api/x", ctx -> { });
        r.auth("GET", "/api/y", ctx -> { });
        r.role("GET", "/api/z", "admin", ctx -> { });
        r.anyRole("GET", "/api/w", ctx -> { }, "admin", "org_manager");
        r.rateLimited("POST", "/api/rl", "scope", ctx -> { });
        A.eq(5, r.routeCount());
        A.notNull(r.match("GET", "/api/x"));
        A.notNull(r.match("GET", "/api/z"));
    }

    @DocuTest
    public void queryParsing() {
        Map<String, String> q = Ctx.parseQuery("a=1&b=hello%20world&flag&empty=&k=v%2Fx");
        A.eq("1", q.get("a"));
        A.eq("hello world", q.get("b"));
        A.eq("", q.get("flag"));
        A.eq("", q.get("empty"));
        A.eq("v/x", q.get("k"));
        A.isTrue(Ctx.parseQuery(null).isEmpty());
        A.isTrue(Ctx.parseQuery("").isEmpty());
    }
}
