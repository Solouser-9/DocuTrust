package com.docutrust.db;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

// Applies V*.sql migrations in filename order, one transaction per file; idempotent via schema_migrations.
public final class Migrator {
    private Migrator() {}

    public static List<String> apply(Database db, String dir) {
        Path folder = Path.of(dir);
        if (!Files.isDirectory(folder)) throw new IllegalStateException("Migrations directory not found: " + dir + " (set MIGRATIONS_DIR)");
        List<Path> files;
        try (Stream<Path> s = Files.list(folder)) {
            files = s.map(Path::getFileName).map(Path::toString)
                    .filter(n -> n.startsWith("V") && n.endsWith(".sql")).sorted()
                    .map(folder::resolve).toList();
        } catch (Exception e) {
            throw new IllegalStateException("Cannot list migrations in " + dir + ": " + e.getMessage(), e);
        }
        List<String> ran = new ArrayList<>();
        for (Path p : files) {
            String name = p.getFileName().toString();
            boolean applied = db.tx(c -> {
                try (Statement st = c.createStatement()) {
                    st.execute("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
                }
                try (PreparedStatement ps = c.prepareStatement("SELECT name FROM schema_migrations WHERE name = ?")) {
                    ps.setString(1, name);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) return false;
                    }
                }
                String sql = Files.readString(p);
                for (String stmt : split(sql)) {
                    try (Statement st = c.createStatement()) { st.execute(stmt); }
                }
                try (PreparedStatement ps = c.prepareStatement("INSERT INTO schema_migrations(name) VALUES (?)")) {
                    ps.setString(1, name);
                    ps.executeUpdate();
                }
                return true;
            });
            if (applied) ran.add(name);
        }
        return ran;
    }

    // Splits on top-level ';' while respecting '...' strings (with '' escapes), $$ dollar-quoted
    // bodies and -- line comments (C-2/C-13: V03 carries a ';' inside a comment, which used to
    // cut the CREATE TABLE statement in half on fresh databases).
    static List<String> split(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inSingle = false;
        boolean inDollar = false;
        boolean inLineComment = false;
        for (int i = 0; i < sql.length(); i++) {
            char ch = sql.charAt(i);
            if (inDollar) {
                cur.append(ch);
                if (ch == '$' && i + 1 < sql.length() && sql.charAt(i + 1) == '$') { cur.append('$'); i++; inDollar = false; }
                continue;
            }
            if (ch == '$' && i + 1 < sql.length() && sql.charAt(i + 1) == '$') { cur.append("$$"); i++; inDollar = true; continue; }
            if (ch == '\'') {
                cur.append(ch);
                if (inSingle) {
                    if (i + 1 < sql.length() && sql.charAt(i + 1) == '\'') { cur.append('\''); i++; }
                    else inSingle = false;
                } else inSingle = true;
                continue;
            }
            if (!inSingle && !inLineComment && ch == '-' && i + 1 < sql.length() && sql.charAt(i + 1) == '-') {
                cur.append("--");
                i++;
                inLineComment = true;
                continue;
            }
            if (inLineComment) {
                cur.append(ch);
                if (ch == '\n') inLineComment = false;
                continue;
            }
            if (ch == ';' && !inSingle) { out.add(cur.toString()); cur.setLength(0); continue; }
            cur.append(ch);
        }
        if (hasCode(cur.toString())) out.add(cur.toString());
        return out;
    }

    private static boolean hasCode(String s) {
        for (String line : s.split("\n", -1)) {
            String t = line.trim();
            if (!t.isEmpty() && !t.startsWith("--")) return true;
        }
        return false;
    }
}
