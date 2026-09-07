# Official image only -- no custom database engine.
# Tag verified against hub.docker.com/_/postgres tags page, not memory.
FROM postgres:17.11-alpine

# POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD are supplied at
# container start by Kubernetes (ConfigMap + Secret) -- never baked in here.
COPY init/01-init.sql /docker-entrypoint-initdb.d/01-init.sql
