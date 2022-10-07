FROM nginx:1.23.1-alpine
RUN addgroup -g 1000 toda && adduser -u 1000 -g toda -G toda -D toda
RUN apk add nodejs npm
ARG NPM_PREFIX=/home/toda/.npm-packages
ENV PATH="${NPM_PREFIX}/bin:${PATH}"
USER toda:toda
RUN npm config set prefix=${NPM_PREFIX}
RUN npm install -g todajs@0.1.4
USER root:root
RUN ln -sf ${NPM_PREFIX}/lib/node_modules/todajs/src/web/dist /srv/todaweb
COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf
COPY --chown=toda:toda todaconfig.yml /home/toda/.toda/config
COPY docker-entrypoint.sh /docker-entrypoint.d/01-start-toda.sh
