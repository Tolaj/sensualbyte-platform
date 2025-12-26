# Official Cloudflare image
FROM cloudflare/cloudflared:latest

# cloudflared runs as non-root (user: nonroot)
# Home: /home/nonroot

# Create required directories
RUN mkdir -p /home/nonroot/.cloudflared \
    && mkdir -p /etc/cloudflared \
    && chown -R nonroot:nonroot /home/nonroot /etc/cloudflared

# Copy tunnel config into image
COPY config.yml /etc/cloudflared/config.yml

USER nonroot

# Start tunnel
CMD ["tunnel", "--config", "/etc/cloudflared/config.yml", "run"]
