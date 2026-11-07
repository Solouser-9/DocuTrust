# Stage 1: Build the application
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

# Stage 2: Run the application
FROM eclipse-temurin:21-jre
WORKDIR /app

# FIX: Create a non-root user and group to satisfy the security warning
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Copy the jar and give ownership to the new user
COPY --from=build --chown=appuser:appgroup /app/target/docutrust-server.jar app.jar

# Switch to the non-root user
USER appuser

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]