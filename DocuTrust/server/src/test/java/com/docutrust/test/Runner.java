package com.docutrust.test;

import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * Minimal test runner: discovers every class named *Test in the same directory tree as this class,
 * invokes its public no-arg @DocuTest methods, counts pass/fail and exits 1 on any failure.
 */
public final class Runner {
    private Runner() {}

    private static int passed = 0;
    private static final List<String> failures = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        List<Class<?>> classes = discover();
        if (classes.isEmpty()) {
            System.out.println("No test classes found");
            System.exit(1);
        }
        long t0 = System.currentTimeMillis();
        for (Class<?> clazz : classes) {
            Object instance = null;
            try {
                instance = clazz.getDeclaredConstructor().newInstance();
            } catch (Throwable t) {
                failures.add(clazz.getName() + " <init>: " + t);
                continue;
            }
            for (Method m : clazz.getMethods()) {
                if (!m.isAnnotationPresent(DocuTest.class)) continue;
                if (m.getParameterCount() != 0 || m.getReturnType() != void.class) continue;
                run(instance, m);
            }
        }
        long ms = System.currentTimeMillis() - t0;
        System.out.println();
        System.out.println("=================================================");
        System.out.println("DocuTest summary: " + passed + " passed, " + failures.size() + " failed in " + ms + " ms");
        for (String f : failures) System.out.println("  FAIL " + f);
        System.out.println("=================================================");
        System.exit(failures.isEmpty() ? 0 : 1);
    }

    private static void run(Object instance, Method m) {
        String name = instance.getClass().getSimpleName() + "." + m.getName();
        try {
            m.invoke(instance);
            passed++;
            System.out.println("  ok   " + name);
        } catch (Throwable t) {
            Throwable cause = t instanceof java.lang.reflect.InvocationTargetException && t.getCause() != null ? t.getCause() : t;
            failures.add(name + ": " + cause);
            System.out.println("  FAIL " + name + ": " + cause);
        }
    }

    /** Walks the directory this class was loaded from and collects *Test classes (skipping inner classes). */
    private static List<Class<?>> discover() throws Exception {
        Path root = Path.of(Runner.class.getProtectionDomain().getCodeSource().getLocation().toURI());
        Path pkg = root.resolve("com/docutrust/test");
        if (!Files.isDirectory(pkg)) return List.of();
        List<Class<?>> out = new ArrayList<>();
        try (Stream<Path> s = Files.walk(pkg)) {
            for (Path p : s.sorted(Comparator.comparing(Path::toString)).toList()) {
                String name = p.getFileName().toString();
                if (!name.endsWith("Test.class") || name.contains("$")) continue;
                String fqn = "com.docutrust.test." + name.substring(0, name.length() - ".class".length());
                try {
                    Class<?> clazz = Class.forName(fqn);
                    if (clazz != Runner.class && !java.lang.reflect.Modifier.isAbstract(clazz.getModifiers())) out.add(clazz);
                } catch (Throwable t) {
                    failures.add(fqn + " <load>: " + t);
                }
            }
        }
        return out;
    }
}
