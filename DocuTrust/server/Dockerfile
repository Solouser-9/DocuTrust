# Stage 1: Build all three services
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY DocuTrust/server ./server

RUN cd server && mvn -q clean package -pl gateway,auth-service,core-service -am -DskipTests \
    && mkdir -p /jars \
    && cp gateway/target/docutrust-gateway.jar /jars/gateway.jar \
    && cp auth-service/target/docutrust-auth-service.jar /jars/auth.jar \
    && cp core-service/target/docutrust-core-service.jar /jars/core.jar

# Stage 2: The runtime image with all 3 JARs
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd -r appgroup && useradd -r -g appgroup appuser \
    && mkdir -p /app/data/vault && chown -R appuser:appgroup /app

COPY --from=build --chown=appuser:appgroup /jars/gateway.jar gateway.jar
COPY --from=build --chown=appuser:appgroup /jars/auth.jar auth.jar
COPY --from=build --chown=appuser:appgroup /jars/core.jar core.jar
COPY --chown=appuser:appgroup DocuTrust/database ./database

USER appuser
EXPOSE 8080

# Start Core on 9000, Auth on 8081, and Gateway on Render's injected PORT (or 8080)
CMD ["sh", "-c", "PORT=9000 MIGRATOR_ENABLED=true DB_POOL_MAX=5 java -jar core.jar & PORT=8081 DB_POOL_MAX=5 java -jar auth.jar & PORT=${PORT:-8080} java -jar gateway.jar"]
