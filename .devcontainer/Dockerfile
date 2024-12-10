FROM ubuntu:22.04
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

RUN apt-get update && apt-get install -y git curl unzip lsof

ENV NVM_DIR /usr/local/nvm
RUN mkdir -p $NVM_DIR \
    && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

ENV NODE_VERSION 22.9.0
RUN source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default
ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PNPM_HOME /root/.local/share/pnpm
ENV PATH      $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PNPM_HOME:$PATH

RUN corepack enable pnpm
EXPOSE 8788
