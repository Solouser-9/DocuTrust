# DocuTrust server — multi-stage build (Phase 6)
#
# ONE builder stage compiles the whole Maven reactor; THREE selectable runner stages
# each package exactly one runnable jar. Pick the runner with:
#     docker build --target gateway -f DocuTrust/server/Dockerfile .   (from the repo root)
# or via docker-compose.yml (services gateway / auth-service / core-service set `target:`).
#
# Build context is the REPOSITORY ROOT (the Dockerfile COPYs DocuTrust/server and
# DocuTrust/database), matching docker-compose.yml's `context: .`.

# ---------------------------------------------------------------- builder
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy the multi-module server tree (parent + shared + core-service + auth-service
# + gateway + the vault/admin stubs). Maven resolves the eight pinned libraries itself.
COPY DocuTrust/server ./server

# Build the three runnable services and their shared dependency (-am builds shared first),
# then collect the shaded jars under predictable names for the runner stages.
RUN cd server && mvn -q clean package -pl gateway,auth-service,core-service -am -DskipTests \
 && mkdir -p /jars \
 && cp gateway/target/docutrust-gateway.jar            /jars/gateway.jar \
 && cp auth-service/target/docutrust-auth-service.jar  /jars/auth.jar \
 && cp core-service/target/docutrust-core-service.jar  /jars/core.jar

# ---------------------------------------------------------------- gateway (:8080)
# The receptionist: pure-JDK reverse proxy. Needs no database, no vault, no migrations.
FROM eclipse-temurin:21-jre AS gateway
WORKDIR /app
RUN groupadd -r appgroup && useradd -r -g appgroup appuser \
 && chown -R appuser:appgroup /app
COPY --from=build --chown=appuser:appgroup /jars/gateway.jar app.jar
USER appuser
ENV PORT=8080
# CORE_URL / AUTH_URL come from the environment (docker-compose.yml sets them to
# http://core-service:9000 and http://auth-service:8081).
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

# ---------------------------------------------------------------- auth-service (:8081)
# The bouncer: 18 /api/auth/* routes + health. Reads the SAME .env secrets as core
# (JWT_SECRET for cross-service JWT validation, VAULT_DIR/VAULT_KEY for MFA secrets).
FROM eclipse-temurin:21-jre AS auth
WORKDIR /app
RUN groupadd -r appgroup && useradd -r -g appgroup appuser \
 && mkdir -p /app/data/vault && chown -R appuser:appgroup /app
COPY --from=build --chown=appuser:appgroup /jars/auth.jar app.jar
USER appuser
ENV PORT=8081 \
    VAULT_DIR=/app/data/vault
# DB_URL / DB_USER / DB_PASSWORD / JWT_SECRET / VAULT_KEY / DB_POOL_MAX come from the
# environment (.env via docker-compose.yml). auth-service NEVER runs migrations.
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]

# ---------------------------------------------------------------- core-service (:9000)
# The vault room: 56 routes incl. RC-1 accept-invite. The only migrator, the only
# seeder, the only ExpiryScheduler (single-JVM contract).
FROM eclipse-temurin:21-jre AS core
WORKDIR /app
RUN groupadd -r appgroup && useradd -r -g appgroup appuser \
 && mkdir -p /app/data/vault && chown -R appuser:appgroup /app
COPY --from=build --chown=appuser:appgroup /jars/core.jar app.jar
# The migration runner needs the numbered V*.sql files at runtime.
COPY --chown=appuser:appgroup DocuTrust/database ./database
USER appuser
ENV PORT=9000 \
    MIGRATIONS_DIR=/app/database/migrations \
    VAULT_DIR=/app/data/vault
# DB_URL / DB_USER / DB_PASSWORD / JWT_SECRET / VAULT_KEY / SEED_DEMO / DB_POOL_MAX /
# MIGRATOR_ENABLED / MAIL_MODE / BREVO_* come from the environment (.env via compose).
EXPOSE 9000
ENTRYPOINT ["java", "-jar", "app.jar"]
