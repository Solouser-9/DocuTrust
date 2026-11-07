package com.docutrust;

// Application error carrying HTTP status, machine-readable code, message and optional field.
public class AppException extends RuntimeException {
    public final int status;
    public final String code;
    public final String field;

    public AppException(int status, String code, String message) { this(status, code, message, null); }

    public AppException(int status, String code, String message, String field) {
        super(message);
        this.status = status;
        this.code = code;
        this.field = field;
    }

    public static AppException validation(String field, String msg) { return new AppException(400, "VALIDATION_ERROR", msg, field); }
    public static AppException unauthorized(String msg) { return new AppException(401, "UNAUTHORIZED", msg); }
    public static AppException forbidden(String msg) { return new AppException(403, "FORBIDDEN", msg); }
    public static AppException notFound(String msg) { return new AppException(404, "NOT_FOUND", msg); }
    public static AppException conflict(String msg) { return new AppException(409, "CONFLICT", msg); }
    public static AppException tooLarge(String msg) { return new AppException(413, "FILE_TOO_LARGE", msg); }
    public static AppException unsupportedMedia(String msg) { return new AppException(415, "UNSUPPORTED_MEDIA_TYPE", msg); }
    public static AppException rateLimited() { return new AppException(429, "RATE_LIMITED", "Too many requests, slow down"); }
    public static AppException internal(String msg) { return new AppException(500, "INTERNAL_ERROR", msg); }
}
