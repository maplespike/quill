FROM docker.io/nginx:alpine

# Copy static portal files
COPY . /usr/share/nginx/html

# Remove server-side files not needed in the container
RUN rm -f /usr/share/nginx/html/server.py /usr/share/nginx/html/package.json /usr/share/nginx/html/README.md

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
