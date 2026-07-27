$ErrorActionPreference = 'Stop'
$preferredPort = 8765
$lastPort = 8799
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = $null
$port = $null

foreach ($candidatePort in $preferredPort..$lastPort) {
  $candidateListener = [System.Net.HttpListener]::new()
  $candidateListener.Prefixes.Add("http://localhost:$candidatePort/")
  try {
    $candidateListener.Start()
    $listener = $candidateListener
    $port = $candidatePort
    break
  }
  catch [System.Net.HttpListenerException] {
    $candidateListener.Close()
  }
}

if ($null -eq $listener) {
  throw "DutchDeck could not find a free local port between $preferredPort and $lastPort. Close old DutchDeck/PowerShell server windows and try again."
}

$url = "http://localhost:$port/"
Write-Host "DutchDeck Studio is running at $url" -ForegroundColor Green
if ($port -ne $preferredPort) {
  Write-Host "Port $preferredPort was already occupied, so DutchDeck selected port $port." -ForegroundColor Yellow
  Write-Host "For consistent saved data, close the old server before your next session." -ForegroundColor Yellow
}
Write-Host "Keep this window open. Press Ctrl+C to stop DutchDeck."

try {
  Start-Process "msedge.exe" $url
}
catch {
  Start-Process $url
}

$mime = @{
  '.html'='text/html; charset=utf-8'
  '.css'='text/css; charset=utf-8'
  '.js'='text/javascript; charset=utf-8'
  '.webmanifest'='application/manifest+json'
  '.png'='image/png'
  '.json'='application/json; charset=utf-8'
  '.svg'='image/svg+xml'
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $path = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }

      $rootFull = [IO.Path]::GetFullPath($root)
      $candidate = [IO.Path]::GetFullPath((Join-Path $root $path))

      if (-not $candidate.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $candidate -PathType Leaf)) {
        $context.Response.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
      }
      else {
        $ext = [IO.Path]::GetExtension($candidate).ToLowerInvariant()
        $context.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $context.Response.Headers.Add('Cache-Control', 'no-cache')
        $bytes = [IO.File]::ReadAllBytes($candidate)
      }

      $context.Response.ContentLength64 = $bytes.Length
      try {
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      }
      catch [System.Net.HttpListenerException] {
        # The browser may cancel a request during refresh, navigation, or shutdown.
        # This is harmless and should not stop the local server.
      }
      catch [System.IO.IOException] {
        # Ignore disconnected clients and aborted network writes.
      }
    }
    finally {
      try { $context.Response.OutputStream.Close() } catch {}
      try { $context.Response.Close() } catch {}
    }
  }
}
finally {
  if ($null -ne $listener) {
    $listener.Stop()
    $listener.Close()
  }
}
