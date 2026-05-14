FROM docker.io/nginx:alpine

# Copy static portal files
COPY . /usr/share/nginx/html

# Remove server-side files not needed in the container
RUN rm -f /usr/share/nginx/html/server.py /usr/share/nginx/html/package.json /usr/share/nginx/html/README.md

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Pre-create nginx temp directories for non-root operation (K8s securityContext runAsUser: 1001)
# Without this, nginx fails at startup with: mkdir() "/var/cache/nginx/client_temp" failed (13: Permission denied)
RUN mkdir -p /var/cache/nginx/client_temp \
    && mkdir -p /var/cache/nginx/proxy_temp \
    && mkdir -p /var/cache/nginx/fastcgi_temp \
    && mkdir -p /var/cache/nginx/uwsgi_temp \
    && mkdir -p /var/cache/nginx/scgi_temp \
    && chmod -R 777 /var/cache/nginx

# Fix PID file location for non-root operation (runAsUser: 1001)
# Default nginx.conf has "pid /run/nginx.pid;" which non-root can't write
RUN sed -i 's|pid\s*/run/nginx.pid;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
