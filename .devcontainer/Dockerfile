FROM mcr.microsoft.com/playwright:v1.60.0

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        build-essential \
        python3 \
        postgresql-client \
        ca-certificates \
        curl \
        wget \
        jq \
        procps \
        less \
        nano \
        vim-tiny \
        openssh-client \
        sudo \
    && rm -rf /var/lib/apt/lists/* \
    && if getent passwd 1000 >/dev/null; then \
           existing_user="$(getent passwd 1000 | cut -d: -f1)"; \
           existing_group="$(getent group 1000 | cut -d: -f1)"; \
           [ "$existing_user" != "node" ] && usermod -l node -d /home/node -m "$existing_user"; \
           [ -n "$existing_group" ] && [ "$existing_group" != "node" ] && groupmod -n node "$existing_group"; \
       else \
           groupadd --gid 1000 node && useradd --uid 1000 --gid node --shell /bin/bash --create-home node; \
       fi \
    && echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# SOPS + age : déchiffrement des secrets au `pnpm setup` (voir tuto/2_sops.md)
RUN ARCH="$(dpkg --print-architecture)" \
    && curl -fsSL "https://github.com/getsops/sops/releases/download/v3.13.1/sops-v3.13.1.linux.${ARCH}" -o /usr/local/bin/sops \
    && chmod +x /usr/local/bin/sops \
    && curl -fsSL "https://github.com/FiloSottile/age/releases/download/v1.2.1/age-v1.2.1-linux-${ARCH}.tar.gz" | tar -xz -C /tmp \
    && mv /tmp/age/age /tmp/age/age-keygen /usr/local/bin/ \
    && rm -rf /tmp/age

RUN corepack enable \
    && corepack prepare pnpm@11.6.0 --activate

RUN npm install -g @anthropic-ai/claude-code

WORKDIR /workspace

ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV SHELL=/usr/bin/zsh

CMD ["sleep", "infinity"]
