param(
    [string]$Node = 'node',
    [string]$BrowserPath = '',
    [string]$Executable = ''
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path "$PSScriptRoot/../..").Path
if (-not $Executable) { $Executable = Join-Path $repo 'dist/GERT-Studio-Windows/GERT Studio.exe' }
$stateDir = Join-Path $repo 'build/browser-verification-state'
$stateFile = Join-Path $stateDir 'instance.json'
$previousBaseUrl = $env:E2E_BASE_URL
$previousBrowserPath = $env:PLAYWRIGHT_BROWSERS_PATH
$process = $null
Push-Location (Join-Path $repo 'frontend')
try {
    if ($BrowserPath) { $env:PLAYWRIGHT_BROWSERS_PATH = $BrowserPath }
    $process = Start-Process -FilePath $Executable -ArgumentList @('--headless', '--no-browser', '--state-dir', "`"$stateDir`"") -WindowStyle Hidden -PassThru
    $deadline = (Get-Date).AddSeconds(45)
    do {
        if ($process.HasExited) { throw 'Packaged process exited during browser test startup.' }
        if (Test-Path -LiteralPath $stateFile) {
            $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
            if ($state.pid -eq $process.Id) { break }
        }
        Start-Sleep -Milliseconds 100
    } while ((Get-Date) -lt $deadline)
    if (-not $state -or $state.pid -ne $process.Id) { throw 'Packaged process did not become ready.' }
    $env:E2E_BASE_URL = "http://127.0.0.1:$($state.port)"
    & $Node node_modules/@playwright/test/cli.js test
    if ($LASTEXITCODE -ne 0) { throw 'Existing browser tests failed against the Windows package.' }
    & $Node (Join-Path $PSScriptRoot 'verify-offline.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Offline browser verification failed.' }
} finally {
    if ($process -and -not $process.HasExited) {
        $stop = Start-Process -FilePath $Executable -ArgumentList @('--headless', '--stop', '--state-dir', "`"$stateDir`"") -WindowStyle Hidden -PassThru
        if (-not $stop.WaitForExit(15000)) { throw 'Stop request timed out.' }
        if (-not $process.WaitForExit(30000)) { throw 'Packaged server did not shut down after browser tests.' }
    }
    $env:E2E_BASE_URL = $previousBaseUrl
    $env:PLAYWRIGHT_BROWSERS_PATH = $previousBrowserPath
    Pop-Location
}
