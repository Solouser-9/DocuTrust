package com.docutrust.db;

import java.sql.Connection;
import java.sql.SQLException;

// HikariCP-backed JDBC pool. The public surface (get/release/with/tx/healthy/close and the
// constructor signature) is unchanged from the hand-rolled pool it replaces - callers cannot
// tell the difference, which is the point: pooling policy became a configuration concern
// (min/max idle, lifetime, connection init SQL) instead of hand-written queue management.
public final class Database {
    public interface SQLWork<T> { T run(Connection c) throws Exception; }

    private final com.zaxxer.hikari.HikariDataSource ds;

    public Database(String url, String user, String password, int min, int max, String initSql) throws SQLException {
        com.zaxxer.hikari.HikariConfig hc = new com.zaxxer.hikari.HikariConfig();
        hc.setJdbcUrl(url);
        if (user != null) {
            hc.setUsername(user);
            hc.setPassword(password);
        }
        hc.setMinimumIdle(min);
        hc.setMaximumPoolSize(max);
        hc.setPoolName("docutrust");
        hc.setConnectionTimeout(10_000);
        hc.setMaxLifetime(1_800_000); // retire connections before Postgres default idle timeouts
        if (initSql != null && !initSql.isBlank()) hc.setConnectionInitSql(initSql);
        ds = new com.zaxxer.hikari.HikariDataSource(hc);
    }

    /** Borrows a pooled connection; ALWAYS return it via release() (or use with()/tx()). */
    public Connection get() throws SQLException {
        return ds.getConnection();
    }

    public void release(Connection c) {
        if (c == null) return;
        try { c.close(); } catch (SQLException ignored) { } // with Hikari, close() returns the connection to the pool
    }

    public <T> T with(SQLWork<T> work) {
        Connection c = null;
        try {
            c = get();
            return work.run(c);
        } catch (Exception e) {
            throw Tx.rethrow(e);
        } finally {
            release(c);
        }
    }

    public <T> T tx(SQLWork<T> work) { return with(c -> Tx.with(c, work)); }

    public boolean healthy() {
        try (Connection c = get();
             var st = c.prepareStatement("SELECT 1")) {
            st.executeQuery().next();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public void close() {
        ds.close();
    }

    /** Live pool telemetry for /api/health (idle - busy = available right now). */
    public int poolIdle() { return ds.getHikariPoolMXBean() == null ? -1 : ds.getHikariPoolMXBean().getIdleConnections(); }

    public int poolActive() { return ds.getHikariPoolMXBean() == null ? -1 : ds.getHikariPoolMXBean().getActiveConnections(); }
}
