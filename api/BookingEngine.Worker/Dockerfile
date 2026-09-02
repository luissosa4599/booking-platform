# Build context is api/ (this Dockerfile lives one level down —
# docker-compose.yml sets `context: ./api, dockerfile: BookingEngine.Worker/Dockerfile`)
# for the same relative-ProjectReference reason as api/Dockerfile.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish BookingEngine.Worker/BookingEngine.Worker.csproj -c Release -o /app/publish --no-self-contained

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "BookingEngine.Worker.dll"]
