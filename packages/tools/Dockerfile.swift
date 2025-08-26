FROM alpine:latest
ARG http_proxy
ARG https_proxy
ARG no_proxy
ARG app_path
ARG app_name
ARG app_ver
ENV APP ${APP}
ENV APP_VERSION ${app_ver}

VOLUME /$app_path/data

WORKDIR /$app_path

RUN apk add --no-cache \
    python3 py3-pip \
    gcc python3-dev musl-dev linux-headers
RUN pip3 install --upgrade pip
RUN pip3 install --user setuptools python-swiftclient python-keystoneclient
RUN mv /root/.local/bin/* /usr/local/bin
RUN apk -v --purge del gcc python3-dev musl-dev linux-headers

ENTRYPOINT ["swift"]
