using Google.Apis.Auth.OAuth2;
using Google.Cloud.Storage.V1;

namespace BookingEngine.Api.Infrastructure.Storage;

public interface IImageStorage
{
    bool Enabled { get; }
    Task<(string UploadUrl, string PublicUrl)> CreateUploadUrlAsync(
        Guid resourceId, string contentType, CancellationToken ct = default);
    bool OwnsUrl(Guid resourceId, string url);
}

/// <summary>
/// Issues V4 signed PUT URLs so the app uploads space photos straight to a GCS
/// bucket (the API never touches the bytes). Objects are public-read with
/// unguessable GUID names.
///
/// Signing needs a service account that has <c>roles/storage.objectAdmin</c> on
/// the bucket, but the API never holds that account's key — V4 URLs are signed
/// through the IAM Credentials API (<c>signBlob</c>). Config:
///   <c>GCS_BUCKET</c>                 - bucket name; required to enable this at all.
///   <c>GCS_SIGNER_SERVICE_ACCOUNT</c> - the signer SA's email. Local dev: keep it
///        set and let Application Default Credentials (<c>gcloud auth
///        application-default login</c>) impersonate it — the developer needs
///        <c>roles/iam.serviceAccountTokenCreator</c> on that SA and the IAM
///        Credentials API enabled. Deployed with that SA attached: leave it unset,
///        ADC already *is* the signer and signs directly.
///   <c>GCS_CREDENTIALS_PATH</c> / <c>GCS_CREDENTIALS_JSON</c> - legacy fallback,
///        a downloaded SA key. Only usable where an org policy doesn't block key
///        creation; the keyless path above is preferred.
/// Disabled — every call is a no-op / 503 — until <c>GCS_BUCKET</c> plus a
/// working signer are configured.
/// </summary>
public class GcsImageStorage : IImageStorage
{
    private static readonly TimeSpan UploadUrlLifetime = TimeSpan.FromMinutes(10);

    private readonly string? _bucket;
    private readonly UrlSigner? _signer;

    public GcsImageStorage(IConfiguration config, ILogger<GcsImageStorage> logger)
    {
        _bucket = config["GCS_BUCKET"];
        if (string.IsNullOrWhiteSpace(_bucket))
        {
            return;
        }

        try
        {
            _signer = BuildSigner(config);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "GCS signer setup failed - image uploads disabled.");
        }
    }

    private static UrlSigner BuildSigner(IConfiguration config)
    {
        // Legacy: a downloaded service-account key, if one is configured (signs
        // locally, no IAM Credentials API call). Kept for environments where the
        // org allows key creation.
        var keyJson = config["GCS_CREDENTIALS_JSON"];
        var keyPath = config["GCS_CREDENTIALS_PATH"];
        if (string.IsNullOrWhiteSpace(keyJson)
            && !string.IsNullOrWhiteSpace(keyPath)
            && File.Exists(keyPath))
        {
            keyJson = File.ReadAllText(keyPath);
        }
        if (!string.IsNullOrWhiteSpace(keyJson))
        {
            var sa = CredentialFactory.FromJson<ServiceAccountCredential>(keyJson);
            return UrlSigner.FromCredential(sa.ToGoogleCredential());
        }

        // Keyless: Application Default Credentials. When ADC is already a service
        // account (deployed with the signer SA attached) it can sign V4 URLs
        // directly via signBlob; when it's a user (local dev) it impersonates the
        // signer SA named by GCS_SIGNER_SERVICE_ACCOUNT. Both routes call the IAM
        // Credentials API rather than using a local private key.
        var credential = GoogleCredential.GetApplicationDefault();
        var signerSa = config["GCS_SIGNER_SERVICE_ACCOUNT"];
        if (!string.IsNullOrWhiteSpace(signerSa))
        {
            credential = credential.Impersonate(new ImpersonatedCredential.Initializer(signerSa));
        }
        return UrlSigner.FromCredential(credential);
    }

    public bool Enabled => _signer is not null && !string.IsNullOrWhiteSpace(_bucket);

    private string PublicPrefix(Guid resourceId) =>
        $"https://storage.googleapis.com/{_bucket}/spaces/{resourceId}/";

    /// <summary>
    /// A one-shot signed PUT URL for a new object, plus the public URL it will
    /// have once uploaded. The upload must send exactly <paramref name="contentType"/>.
    /// </summary>
    public async Task<(string UploadUrl, string PublicUrl)> CreateUploadUrlAsync(
        Guid resourceId, string contentType, CancellationToken ct = default)
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

        var uploadUrl = await _signer!.SignAsync(template, options, ct);
        var publicUrl = $"https://storage.googleapis.com/{_bucket}/{objectName}";
        return (uploadUrl, publicUrl);
    }

    /// <summary>True when <paramref name="url"/> points at an object under this
    /// resource's prefix in our bucket — guards the "register an uploaded URL"
    /// endpoint against a caller passing an arbitrary URL.</summary>
    public bool OwnsUrl(Guid resourceId, string url) =>
        Enabled && url.StartsWith(PublicPrefix(resourceId), StringComparison.Ordinal);
}
