FROM postgis/postgis:16-3.5

RUN apt-get update && apt-get install -y --no-install-recommends build-essential git postgresql-server-dev-16 \
    && git clone --depth 1 --branch v0.8.6 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && make -C /tmp/pgvector && make -C /tmp/pgvector install \
    && rm -rf /tmp/pgvector /var/lib/apt/lists/*

COPY backend/db/init.sql /docker-entrypoint-initdb.d/20-rapid-extensions.sql
