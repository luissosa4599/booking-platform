# Build context is api/ (the parent of this file) — BookingEngine.Api
# references sibling projects (BookingEngine.Domain, BookingEngine.Infrastructure)
# by relative path, so the whole api/ tree has to be in the build context,
# not just this project's own folder.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish BookingEngine.Api.csproj -c Release -o /app/publish --no-self-contained

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5190
EXPOSE 5190

ENTRYPOINT ["dotnet", "BookingEngine.Api.dll"]
