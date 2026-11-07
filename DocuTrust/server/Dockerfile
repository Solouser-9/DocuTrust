# Stage 1: Build the application
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy only the server files needed for the build
COPY DocuTrust/server/pom.xml .
COPY DocuTrust/server/src ./src

RUN mvn clean package -DskipTests

# Stage 2: Run the application
FROM eclipse-temurin:21-jre
WORKDIR /app

# Create a non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# FIX: Create the data/vault directories and give appuser ownership of /app
RUN mkdir -p /app/data/vault && chown -R appuser:appgroup /app

# Copy the built jar
COPY --from=build --chown=appuser:appgroup /app/target/docutrust-server.jar app.jar

# Copy the database migrations folder
COPY --chown=appuser:appgroup DocuTrust/database ./database

# Set the MIGRATIONS_DIR environment variable
ENV MIGRATIONS_DIR=./database/migrations

USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
