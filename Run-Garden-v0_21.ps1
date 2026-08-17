[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 8765,

    [switch]$NoOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$siteRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchId = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$localUrl = "http://127.0.0.1:$Port/?mode=presentation&launch=$launchId#top"
$pythonLauncher = $null
$pythonArgs = @()
$pyCommand = Get-Command -Name 'py' -ErrorAction SilentlyContinue

if ($pyCommand) {
    & $pyCommand.Source -3 -c 'import sys; raise SystemExit(0 if sys.version_info.major == 3 else 1)' *> $null
    if ($LASTEXITCODE -eq 0) {
        $pythonLauncher = $pyCommand
        $pythonArgs += '-3'
    }
}

if (-not $pythonLauncher) {
    $pythonLauncher = Get-Command -Name 'python' -ErrorAction SilentlyContinue
    if ($pythonLauncher) {
        & $pythonLauncher.Source -c 'import sys; raise SystemExit(0 if sys.version_info.major == 3 else 1)' *> $null
        if ($LASTEXITCODE -ne 0) {
            $pythonLauncher = $null
        }
    }
}

if (-not $pythonLauncher) {
    throw 'Python 3 was not found. Install or enable Python, then run this launcher again.'
}

$pythonArgs += @('-m', 'http.server', $Port, '--bind', '127.0.0.1', '--directory', $siteRoot)

Write-Host "Garden v0.21 local review: $localUrl"
Write-Host 'The server is available only on this computer. Press Ctrl+C in this window to stop it.'

if (-not $NoOpen) {
    Start-Process -FilePath $localUrl
}

& $pythonLauncher.Source @pythonArgs
if ($LASTEXITCODE -ne 0) {
    throw "The local web server stopped with exit code $LASTEXITCODE."
}
