#!/bin/bash
# Phase 1 file moves: run from DocuTrust/server after tagging (git tag pre-phase1).
set -euo pipefail

mkdir -p shared/src/main/java/com/docutrust/{config,util,model,db,http,infra,auth,service,controller}
mkdir -p core-service/src/main/java/com/docutrust/{bootstrap,auth,service,controller,vault}

# ---- 26 files -> shared (library jar) ----
git mv src/main/java/com/docutrust/AppException.java          shared/src/main/java/com/docutrust/AppException.java
git mv src/main/java/com/docutrust/config/Config.java         shared/src/main/java/com/docutrust/config/Config.java
git mv src/main/java/com/docutrust/util/Json.java             shared/src/main/java/com/docutrust/util/Json.java
git mv src/main/java/com/docutrust/util/Text.java             shared/src/main/java/com/docutrust/util/Text.java
git mv src/main/java/com/docutrust/util/Validator.java        shared/src/main/java/com/docutrust/util/Validator.java
git mv src/main/java/com/docutrust/model/Models.java          shared/src/main/java/com/docutrust/model/Models.java
git mv src/main/java/com/docutrust/db/Database.java           shared/src/main/java/com/docutrust/db/Database.java
git mv src/main/java/com/docutrust/db/Migrator.java           shared/src/main/java/com/docutrust/db/Migrator.java
git mv src/main/java/com/docutrust/db/Rows.java               shared/src/main/java/com/docutrust/db/Rows.java
git mv src/main/java/com/docutrust/db/Tx.java                 shared/src/main/java/com/docutrust/db/Tx.java
git mv src/main/java/com/docutrust/http/Ctx.java              shared/src/main/java/com/docutrust/http/Ctx.java
git mv src/main/java/com/docutrust/http/Handler.java          shared/src/main/java/com/docutrust/http/Handler.java
git mv src/main/java/com/docutrust/http/Middleware.java       shared/src/main/java/com/docutrust/http/Middleware.java
git mv src/main/java/com/docutrust/http/Router.java           shared/src/main/java/com/docutrust/http/Router.java
git mv src/main/java/com/docutrust/infra/Metrics.java         shared/src/main/java/com/docutrust/infra/Metrics.java
git mv src/main/java/com/docutrust/infra/Spotlight.java       shared/src/main/java/com/docutrust/infra/Spotlight.java
git mv src/main/java/com/docutrust/auth/JwtService.java       shared/src/main/java/com/docutrust/auth/JwtService.java
git mv src/main/java/com/docutrust/auth/PasswordService.java  shared/src/main/java/com/docutrust/auth/PasswordService.java
git mv src/main/java/com/docutrust/auth/RateLimiter.java      shared/src/main/java/com/docutrust/auth/RateLimiter.java
git mv src/main/java/com/docutrust/service/AuditService.java  shared/src/main/java/com/docutrust/service/AuditService.java
git mv src/main/java/com/docutrust/service/MailService.java   shared/src/main/java/com/docutrust/service/MailService.java
git mv src/main/java/com/docutrust/service/NotificationService.java shared/src/main/java/com/docutrust/service/NotificationService.java
git mv src/main/java/com/docutrust/service/OtpService.java    shared/src/main/java/com/docutrust/service/OtpService.java
git mv src/main/java/com/docutrust/service/StepUpService.java shared/src/main/java/com/docutrust/service/StepUpService.java
git mv src/main/java/com/docutrust/auth/TokenService.java    shared/src/main/java/com/docutrust/auth/TokenService.java
git mv src/main/java/com/docutrust/controller/HealthController.java shared/src/main/java/com/docutrust/controller/HealthController.java

# ---- 22 files -> core-service (renamed monolith, all 74 routes) ----
git mv src/main/java/com/docutrust/Main.java                  core-service/src/main/java/com/docutrust/Main.java
git mv src/main/java/com/docutrust/bootstrap/Bootstrap.java   core-service/src/main/java/com/docutrust/bootstrap/Bootstrap.java
git mv src/main/java/com/docutrust/auth/MfaService.java       core-service/src/main/java/com/docutrust/auth/MfaService.java
git mv src/main/java/com/docutrust/service/AuthService.java   core-service/src/main/java/com/docutrust/service/AuthService.java
git mv src/main/java/com/docutrust/service/AdminService.java  core-service/src/main/java/com/docutrust/service/AdminService.java
git mv src/main/java/com/docutrust/service/DocumentService.java core-service/src/main/java/com/docutrust/service/DocumentService.java
git mv src/main/java/com/docutrust/service/ExpiryScheduler.java core-service/src/main/java/com/docutrust/service/ExpiryScheduler.java
git mv src/main/java/com/docutrust/service/FolderService.java core-service/src/main/java/com/docutrust/service/FolderService.java
git mv src/main/java/com/docutrust/service/OrgService.java    core-service/src/main/java/com/docutrust/service/OrgService.java
git mv src/main/java/com/docutrust/service/SettingsService.java core-service/src/main/java/com/docutrust/service/SettingsService.java
git mv src/main/java/com/docutrust/service/ShareService.java  core-service/src/main/java/com/docutrust/service/ShareService.java
git mv src/main/java/com/docutrust/service/VerifyService.java core-service/src/main/java/com/docutrust/service/VerifyService.java
git mv src/main/java/com/docutrust/controller/AdminController.java core-service/src/main/java/com/docutrust/controller/AdminController.java
git mv src/main/java/com/docutrust/controller/AuthController.java core-service/src/main/java/com/docutrust/controller/AuthController.java
git mv src/main/java/com/docutrust/controller/DocumentController.java core-service/src/main/java/com/docutrust/controller/DocumentController.java
git mv src/main/java/com/docutrust/controller/FolderController.java core-service/src/main/java/com/docutrust/controller/FolderController.java
git mv src/main/java/com/docutrust/controller/NotificationController.java core-service/src/main/java/com/docutrust/controller/NotificationController.java
git mv src/main/java/com/docutrust/controller/OrgController.java core-service/src/main/java/com/docutrust/controller/OrgController.java
git mv src/main/java/com/docutrust/controller/PublicController.java core-service/src/main/java/com/docutrust/controller/PublicController.java
git mv src/main/java/com/docutrust/controller/ShareController.java core-service/src/main/java/com/docutrust/controller/ShareController.java
git mv src/main/java/com/docutrust/controller/VerificationController.java core-service/src/main/java/com/docutrust/controller/VerificationController.java
git mv src/main/java/com/docutrust/vault/FileVault.java       core-service/src/main/java/com/docutrust/vault/FileVault.java

echo "moves complete: $(git status --porcelain | grep -c '^R') renames staged"
