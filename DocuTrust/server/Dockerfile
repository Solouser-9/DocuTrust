# Stage 1: Build the application (Phase 1 multi-module reactor)
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy the multi-module server tree (parent + shared + core-service + service stubs + gateway)
COPY DocuTrust/server ./server

# Build core-service and its reactor dependencies (-am builds shared first)
RUN cd server && mvn clean package -pl core-service -am -DskipTests -q

# Stage 2: Run the application
FROM eclipse-temurin:21-jre
WORKDIR /app

# Create a non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# FIX: Create the data/vault directories and give appuser ownership of /app
RUN mkdir -p /app/data/vault && chown -R appuser:appgroup /app

# Copy the built core-service shaded jar
COPY --from=build --chown=appuser:appgroup /app/server/core-service/target/docutrust-core-service.jar app.jar

# Copy the database migrations folder
COPY --chown=appuser:appgroup DocuTrust/database ./database

# Set the MIGRATIONS_DIR environment variable
ENV MIGRATIONS_DIR=./database/migrations

USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
