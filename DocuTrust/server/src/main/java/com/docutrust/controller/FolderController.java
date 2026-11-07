package com.docutrust.controller;

import com.docutrust.http.Handler;
import com.docutrust.service.FolderService;

// Thin folder endpoints: CRUD + paginated folder contents.
public final class FolderController {
    private final FolderService folders;

    public FolderController(FolderService folders) { this.folders = folders; }

    public Handler list() {
        return ctx -> ctx.ok(folders.list(ctx.user).stream().map(f -> f.toMap()).toList());
    }

    public Handler create() {
        return ctx -> ctx.created(folders.create(ctx.user, ctx.json(), ctx.ip()).toMap());
    }

    public Handler rename() {
        return ctx -> ctx.ok(folders.rename(ctx.user, ctx.uuidParam("id"), ctx.json(), ctx.ip()).toMap());
    }

    public Handler delete() {
        return ctx -> ctx.ok(folders.delete(ctx.user, ctx.uuidParam("id"), ctx.ip()));
    }

    public Handler documents() {
        return ctx -> ctx.okPage(folders.documents(ctx.user, ctx.uuidParam("id"), ctx.page(), ctx.limit()));
    }
}
