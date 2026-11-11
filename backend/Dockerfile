# Alpine 3.24.4, pinned by digest so the base never changes under us.
FROM alpine@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf

# To bump PocketBase, change the version and the checksum together
# (checksum: linux_amd64 line of the release's checksums.txt).
ARG PB_VERSION=0.40.6
ARG PB_SHA256=0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f

ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN echo "${PB_SHA256}  /tmp/pb.zip" | sha256sum -c - \
 && mkdir -p /pb/pb_data \
 && unzip /tmp/pb.zip -d /pb/ \
 && rm /tmp/pb.zip \
 && adduser -D -H -u 10001 pocketbase \
 && chown -R 10001:10001 /pb

COPY --chown=10001:10001 pb_migrations/ /pb/pb_migrations/
COPY --chown=10001:10001 pb_hooks/ /pb/pb_hooks/
COPY --chown=10001:10001 entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh

USER 10001
EXPOSE 8090
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=10 \
  CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1
ENTRYPOINT ["/pb/entrypoint.sh"]
