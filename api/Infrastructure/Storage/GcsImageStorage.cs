using Google.Apis.Auth.OAuth2;
using Google.Cloud.Storage.V1;

namespace BookingEngine.Api.Infrastructure.Storage;

public interface IImageStorage
{
    bool Enabled { get; }
    (string UploadUrl, string PublicUrl) CreateUploadUrl(Guid resourceId, string contentType);
    bool OwnsUrl(Guid resourceId, string url);
}

/// <summary>
/// Issues V4 signed PUT URLs so the app uploads space photos straight to a GCS
/// bucket (the API never touches the bytes). Objects are public-read with
/// unguessable GUID names. Disabled — every call is a no-op / 503 — when
/// <c>GCS_BUCKET</c> + <c>GCS_CREDENTIALS_JSON</c> aren't both configured.
/// </summary>
public class GcsImageStorage : IImageStorage
{
    private static readonly TimeSpan UploadUrlLifetime = TimeSpan.FromMinutes(10);

    private readonly string? _bucket;
    private readonly UrlSigner? _signer;

    public GcsImageStorage(IConfiguration config, ILogger<GcsImageStorage> logger)
    {
        _bucket = config["GCS_BUCKET"];
        var credentialsJson = config["GCS_CREDENTIALS_JSON"];

        if (string.IsNullOrWhiteSpace(_bucket) || string.IsNullOrWhiteSpace(credentialsJson))
        {
            return;
        }

        try
        {
            var serviceAccount = CredentialFactory.FromJson<ServiceAccountCredential>(credentialsJson);
            _signer = UrlSigner.FromCredential(serviceAccount.ToGoogleCredential());
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "GCS credentials failed to parse — image uploads disabled.");
        }
    }

    public bool Enabled => _signer is not null && !string.IsNullOrWhiteSpace(_bucket);

    private string PublicPrefix(Guid resourceId) =>
        $"https://storage.googleapis.com/{_bucket}/spaces/{resourceId}/";

    /// <summary>
    /// A one-shot signed PUT URL for a new object, plus the public URL it will
    /// have once uploaded. The upload must send exactly <paramref name="contentType"/>.
    /// </summary>
    public (string UploadUrl, string PublicUrl) CreateUploadUrl(Guid resourceId, string contentType)
    {
        var ext = contentType switch
        {
            "image/jpeg" => "jpg",
            "image/png" => "png",
            "image/webp" => "webp",
            _ => "bin",
        };
        var objectName = $"spaces/{resourceId}/{Guid.NewGuid():N}.{ext}";

        var template = UrlSigner.RequestTemplate
            .FromBucket(_bucket!)
            .WithObjectName(objectName)
            .WithHttpMethod(HttpMethod.Put)
            .WithContentHeaders(new Dictionary<string, IEnumerable<string>>
            {
                ["Content-Type"] = new[] { contentType },
            });
        var options = UrlSigner.Options
            .FromDuration(UploadUrlLifetime)
            .WithSigningVersion(SigningVersion.V4);

        var uploadUrl = _signer!.Sign(template, options);
        var publicUrl = $"https://storage.googleapis.com/{_bucket}/{objectName}";
        return (uploadUrl, publicUrl);
    }

    /// <summary>True when <paramref name="url"/> points at an object under this
    /// resource's prefix in our bucket — guards the "register an uploaded URL"
    /// endpoint against a caller passing an arbitrary URL.</summary>
    public bool OwnsUrl(Guid resourceId, string url) =>
        Enabled && url.StartsWith(PublicPrefix(resourceId), StringComparison.Ordinal);
}
