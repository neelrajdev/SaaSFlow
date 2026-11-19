$ErrorActionPreference = "Stop"
$rootPath = $PSScriptRoot
if (Test-Path (Join-Path $PSScriptRoot "saasflow\frontend\index.html")) {
    $rootPath = Join-Path $PSScriptRoot "saasflow"
}
$port = 8080
$listener = $null

while ($port -le 8090) {
    try {
        $tempListener = New-Object System.Net.HttpListener
        $tempListener.Prefixes.Add("http://localhost:$port/")
        $tempListener.Start()
        $listener = $tempListener
        break
    } catch {
        $port++
    }
}

if ($null -eq $listener) {
    Write-Host "Could not bind to any port between 8080 and 8090. Please close conflicting processes." -ForegroundColor Red
    exit 1
}

$url = "http://localhost:$port/frontend/index.html"
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  SaaSFlow Local Server is Running!" -ForegroundColor Green
Write-Host "  URL: $url" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Press Ctrl+C in this window to stop." -ForegroundColor Yellow
Write-Host ""
try {
    Start-Process $url
} catch {
    Write-Host "Please open $url in your browser." -ForegroundColor Gray
}
try {
    while ($listener.IsListening) {
        $context = $null
        try {
            $context = $listener.GetContext()
        } catch [System.Net.HttpListenerException] {
            if (-not $listener.IsListening) { break }
            continue
        } catch {
            if (-not $listener.IsListening) { break }
            continue
        }

        if ($null -eq $context) { continue }

        try {
            $request = $context.Request
            $response = $context.Response
            $response.KeepAlive = $false
            $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")

            $localPath = $request.Url.LocalPath
            $relPath = $localPath.TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($relPath) -or $relPath -eq "/" -or $relPath -eq "index.html") {
                $response.StatusCode = 302
                $response.Headers.Add("Location", "/frontend/index.html")
                $response.Close()
                continue
            }
            if ($relPath -eq "frontend" -or $relPath -eq "frontend/") {
                $response.StatusCode = 302
                $response.Headers.Add("Location", "/frontend/index.html")
                $response.Close()
                continue
            }
            $filePath = Join-Path $rootPath $relPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            if (-not (Test-Path $filePath -PathType Leaf)) {
                $frontendAlt = Join-Path (Join-Path $rootPath "frontend") $relPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
                if (Test-Path $frontendAlt -PathType Leaf) {
                    $filePath = $frontendAlt
                }
            }

            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".css"  { "text/css; charset=utf-8" }
                    ".js"   { "application/javascript; charset=utf-8" }
                    ".json" { "application/json; charset=utf-8" }
                    ".csv"  { "text/csv; charset=utf-8" }
                    ".svg"  { "image/svg+xml" }
                    ".png"  { "image/png" }
                    ".jpg"  { "image/jpeg" }
                    ".jpeg" { "image/jpeg" }
                    ".ico"  { "image/x-icon" }
                    Default { "application/octet-stream" }
                }

                $response.ContentType = $contentType
                $response.ContentLength64 = $bytes.Length
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $custom404 = Join-Path (Join-Path $rootPath "frontend\pages") "404.html"
                if (Test-Path $custom404 -PathType Leaf) {
                    $bytes = [System.IO.File]::ReadAllBytes($custom404)
                    $response.ContentType = "text/html; charset=utf-8"
                    $response.ContentLength64 = $bytes.Length
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                } else {
                    $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $relPath")
                    $response.ContentType = "text/plain; charset=utf-8"
                    $response.ContentLength64 = $notFoundBytes.Length
                    $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
                }
            }
        } catch {
        } finally {
            try {
                if ($null -ne $response) {
                    $response.Close()
                }
            } catch {}
        }
    }
} finally {
    try {
        if ($null -ne $listener -and $listener.IsListening) {
            $listener.Stop()
            $listener.Close()
        }
    } catch {}
}
