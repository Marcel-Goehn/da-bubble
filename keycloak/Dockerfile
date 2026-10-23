# The stack's Keycloak: the stock image plus DA Bubble's provider jar (extension/). The realm and theme
# stay bind-mounted by compose.yaml.
FROM maven:3.9.16-eclipse-temurin-21 AS extension
WORKDIR /build
COPY extension/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY extension/src src
RUN mvn -B -q package

FROM quay.io/keycloak/keycloak:26.8.1
COPY --from=extension /build/target/keycloak-extension-1.0.0.jar /opt/keycloak/providers/
