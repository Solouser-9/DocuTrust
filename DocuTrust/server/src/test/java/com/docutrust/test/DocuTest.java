package com.docutrust.test;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

// Marks a public no-arg test method (custom replacement for JUnit - no external dependencies).
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface DocuTest {
    String value() default "";
}
