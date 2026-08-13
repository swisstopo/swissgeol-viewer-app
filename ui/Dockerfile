FROM node:22-alpine AS build

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

RUN apk add --no-cache git

WORKDIR /app
COPY . .

WORKDIR /app/ui

RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN=$(cat /run/secrets/github_token) \
    npm install --ignore-scripts \
    && npm run build --omit=dev

FROM nginx:alpine

WORKDIR /usr/share/nginx/html
COPY --from=build /app/ui/dist/ /usr/share/nginx/html

# this nginx base image will parse the template and will move it to
# /etc/nginx/conf.d/default.conf before it starts nginx process
COPY ui/nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
