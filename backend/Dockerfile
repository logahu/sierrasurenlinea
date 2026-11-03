# --- Etapa 1: compilar con Maven -------------------------------------------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

# --- Etapa 2: imagen de ejecución ligera --------------------------------------
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/quarkus-app/lib/ ./lib/
COPY --from=build /app/target/quarkus-app/*.jar ./
COPY --from=build /app/target/quarkus-app/app/ ./app/
COPY --from=build /app/target/quarkus-app/quarkus/ ./quarkus/

# El plan gratuito de Render da 512 MB: limitamos el heap para no exceder la memoria.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Djava.util.logging.manager=org.jboss.logmanager.LogManager"
EXPOSE 8080
CMD ["sh", "-c", "java $JAVA_OPTS -jar quarkus-run.jar"]
