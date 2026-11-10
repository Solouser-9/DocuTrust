#!/usr/bin/env bash
# Phase 2 file moves — run from the DocuTrust/ repo root (the directory containing server/).
# The 4 moves are byte-identical renames (verified: git rename detection shows 100% similarity,
# zero content edits inside the moved files). Package names stay com.docutrust.*, so no import
# changes are needed anywhere: core consumers of FileVault (DocumentService, VerifyService,
# ShareService, Bootstrap) import com.docutrust.vault.FileVault, and that package now resolves
# from the shared jar instead of core's own classes.
set -euo pipefail

# Target packages do not exist yet in auth-service/shared — create them first (git mv needs them).
mkdir -p server/auth-service/src/main/java/com/docutrust/controller
mkdir -p server/auth-service/src/main/java/com/docutrust/service
mkdir -p server/auth-service/src/main/java/com/docutrust/auth
mkdir -p server/shared/src/main/java/com/docutrust/vault

git mv server/core-service/src/main/java/com/docutrust/controller/AuthController.java \
       server/auth-service/src/main/java/com/docutrust/controller/AuthController.java
git mv server/core-service/src/main/java/com/docutrust/service/AuthService.java \
       server/auth-service/src/main/java/com/docutrust/service/AuthService.java
git mv server/core-service/src/main/java/com/docutrust/auth/MfaService.java \
       server/auth-service/src/main/java/com/docutrust/auth/MfaService.java
git mv server/core-service/src/main/java/com/docutrust/vault/FileVault.java \
       server/shared/src/main/java/com/docutrust/vault/FileVault.java

# Sanity: 4 staged renames, nothing else.
git status --short
