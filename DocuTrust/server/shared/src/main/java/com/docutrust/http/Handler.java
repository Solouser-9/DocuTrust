package com.docutrust.http;

// Route handler signature shared by Router, Middleware and controllers.
@FunctionalInterface
public interface Handler { void handle(Ctx ctx) throws Exception; }
