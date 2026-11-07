package com.docutrust.controller;

import java.util.Map;

import com.docutrust.http.Ctx;
import com.docutrust.http.Handler;
import com.docutrust.service.DocumentService;

// Thin document endpoints: multipart upload, listing/search, metadata, versions, downloads, history.
public final class DocumentController {
    private final DocumentService documents;

    public DocumentController(DocumentService documents) { this.documents = documents; }

    public Handler upload() {
        return ctx -> ctx.created(documents.upload(ctx.user, ctx.multipart(), ctx.ip()).toMap());
    }

    public Handler list() {
        return ctx -> ctx.okPage(documents.list(ctx.user, ctx.query(), ctx.page(), ctx.limit()));
    }

    public Handler get() {
        return ctx -> ctx.ok(documents.get(ctx.user, ctx.uuidParam("id")).toMap());
    }

    public Handler patch() {
        return ctx -> ctx.ok(documents.patch(ctx.user, ctx.uuidParam("id"), ctx.json(), ctx.ip()).toMap());
    }

    public Handler softDelete() {
        return ctx -> ctx.ok(documents.softDelete(ctx.user, ctx.uuidParam("id"), ctx.ip()));
    }

    public Handler restore() {
        return ctx -> ctx.ok(documents.restore(ctx.user, ctx.uuidParam("id"), ctx.ip()));
    }

    public Handler permanentDelete() {
        return ctx -> ctx.ok(documents.permanentDelete(ctx.user, ctx.uuidParam("id"), ctx.header("X-Step-Up-Token"), ctx.ip()));
    }

    public Handler addVersion() {
        return ctx -> ctx.created(documents.addVersion(ctx.user, ctx.uuidParam("id"), ctx.multipart(), ctx.ip()).toMap());
    }

    public Handler versions() {
        return ctx -> ctx.ok(documents.versions(ctx.user, ctx.uuidParam("id")).stream().map(v -> v.toMap()).toList());
    }

    public Handler download() {
        return ctx -> send(ctx, documents.download(ctx.user, ctx.uuidParam("id"), null, ctx.ip()));
    }

    public Handler downloadVersion() {
        return ctx -> send(ctx, documents.download(ctx.user, ctx.uuidParam("id"), parseVersion(ctx), ctx.ip()));
    }

    public Handler history() {
        return ctx -> ctx.ok(documents.history(ctx.user, ctx.uuidParam("id")));
    }

    public Handler expiring() {
        return ctx -> ctx.ok(documents.expiring(ctx.user, ctx.intQ("days", 30)));
    }

    private static Integer parseVersion(Ctx ctx) {
        String raw = ctx.param("v");
        if (raw == null || !raw.matches("\\d+")) throw com.docutrust.AppException.notFound("Version not found");
        return Integer.parseInt(raw);
    }

    private static void send(Ctx ctx, DocumentService.FileOut file) {
        ctx.bytes(200, file.contentType() == null ? "application/octet-stream" : file.contentType(),
                file.data(), Map.of("Content-Disposition", "attachment; filename=\"" + file.filename() + "\""));
    }
}
