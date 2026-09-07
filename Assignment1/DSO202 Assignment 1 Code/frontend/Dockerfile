FROM nginx:1.31.3-alpine

# gettext provides envsubst, used at container start to render BACKEND_URL
# into config.js. Not needed at runtime beyond that, but this image has no
# separate build stage to strip it from -- it's a single small binary.
RUN apk add --no-cache gettext

COPY nginx.conf /etc/nginx/nginx.conf
COPY public /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh \
    && chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /etc/nginx

USER nginx
EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
