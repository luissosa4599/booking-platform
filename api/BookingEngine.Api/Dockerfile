# Build context is api/ (this Dockerfile lives one level down — docker-compose.yml
# sets `context: ./api, dockerfile: BookingEngine.Api/Dockerfile`) — BookingEngine.Api
# references sibling projects (BookingEngine.Domain, BookingEngine.Infrastructure)
# by relative path, so the whole api/ tree has to be in the build context,
# not just this project's own folder.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish BookingEngine.Api/BookingEngine.Api.csproj -c Release -o /app/publish --no-self-contained

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
# Npgsql probes for Kerberos/GSSAPI auth support at startup via dlopen; without
# this lib it logs a scary-looking "Cannot load library libgssapi_krb5.so.2"
# before falling back to password auth. We only ever use password auth, but the
# line alarms anyone reading `docker compose logs` — install the lib to keep
# startup quiet.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5190
EXPOSE 5190

ENTRYPOINT ["dotnet", "BookingEngine.Api.dll"]
