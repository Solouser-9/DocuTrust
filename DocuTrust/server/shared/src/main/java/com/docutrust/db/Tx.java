package com.docutrust.db;

import java.sql.Connection;
import java.sql.SQLException;

// Runs a unit of work inside a JDBC transaction: setAutoCommit(false), commit, rollback on any error.
public final class Tx {
    private Tx() {}

    public static <T> T with(Connection c, Database.SQLWork<T> work) {
        boolean old = true;
        try { old = c.getAutoCommit(); } catch (SQLException ignored) { }
        try {
            c.setAutoCommit(false);
            T result = work.run(c);
            c.commit();
            return result;
        } catch (Exception e) {
            try { c.rollback(); } catch (SQLException ignored) { }
            throw rethrow(e);
        } finally {
            try { c.setAutoCommit(old); } catch (SQLException ignored) { }
        }
    }

    public static RuntimeException rethrow(Exception e) {
        if (e instanceof RuntimeException re) return re;
        return new RuntimeException(e);
    }
}
