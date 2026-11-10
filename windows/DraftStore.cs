using System.Text.Json;

namespace CopyClip;

internal sealed record Draft(string Title, string Text, string? PendingText)
{
    internal bool IsValid => Title is { Length: > 0 and <= 120 } && Text is not null;
}

internal sealed class DraftStore(string path)
{
    public (bool Loaded, Draft? Draft) Load()
    {
        try
        {
            using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete);
            var draft = JsonSerializer.Deserialize<Draft>(file, JsonSerializerOptions.Web);
            return draft is { IsValid: true } ? (true, draft) : (false, null);
        }
        catch (FileNotFoundException)
        {
            return (true, null);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException)
        {
            return (false, null);
        }
    }

    public bool Save(JsonElement value)
    {
        var temporaryPath = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            var draft = value.Deserialize<Draft>(JsonSerializerOptions.Web);
            if (draft is not { IsValid: true })
                return false;

            // A terminated write leaves the previous snapshot available for recovery.
            using (var file = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write))
            {
                JsonSerializer.Serialize(file, draft, JsonSerializerOptions.Web);
                file.Flush(flushToDisk: true);
            }
            ReplaceSnapshot(temporaryPath);
            return true;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException)
        {
            return false;
        }
        finally
        {
            try { File.Delete(temporaryPath); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException) { }
        }
    }

    private void ReplaceSnapshot(string temporaryPath)
    {
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                File.Move(temporaryPath, path, overwrite: true);
                return;
            }
            catch (Exception error) when (attempt < 3 && IsFileBusy(error))
            {
                Thread.Sleep(20);
            }
        }
    }

    private static bool IsFileBusy(Exception error) =>
        (error is IOException or UnauthorizedAccessException) &&
        (error.HResult & 0xffff) is 5 or 32 or 33; // Access denied, sharing violation or lock violation.
}
