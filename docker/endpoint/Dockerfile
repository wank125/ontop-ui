FROM eclipse-temurin:17-jre

WORKDIR /opt

COPY docker/ontop-cli /opt/ontop-cli
COPY docker/endpoint/entrypoint.sh /opt/ontop-endpoint/entrypoint.sh
COPY docker/backend/ontop-output/retail_ontology.ttl /opt/ontop-seed/active_ontology.ttl
COPY docker/backend/ontop-output/retail_mapping.obda /opt/ontop-seed/active_mapping.obda
COPY docker/backend/ontop.properties /opt/ontop-seed/active.properties

RUN chmod +x /opt/ontop-endpoint/entrypoint.sh /opt/ontop-cli/ontop

EXPOSE 8080

ENTRYPOINT ["/opt/ontop-endpoint/entrypoint.sh"]
