# Прописывает Cursor TTS hook в %USERPROFILE%\.cursor\hooks.json
# Запуск: powershell -ExecutionPolicy Bypass -File scripts\install_cursor_hook.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$HookCmd = Join-Path $RepoRoot "run_hook.cmd"
$CursorDir = Join-Path $env:USERPROFILE ".cursor"
$HooksFile = Join-Path $CursorDir "hooks.json"

if (-not (Test-Path $HookCmd)) {
    Write-Error "Не найден run_hook.cmd: $HookCmd"
}

$hookEntry = @{
    command = "cmd /c `"$HookCmd`""
    timeout = 30
}
$stopEntry = @{
    command = "cmd /c `"$HookCmd`""
    timeout = 30
    loop_limit = 0
}

New-Item -ItemType Directory -Force -Path $CursorDir | Out-Null

$config = @{ version = 1; hooks = @{} }
if (Test-Path $HooksFile) {
    $existing = Get-Content $HooksFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($existing.hooks) {
        $config.hooks = @{}
        $existing.hooks.PSObject.Properties | ForEach-Object {
            $config.hooks[$_.Name] = $_.Value
        }
    }
}

$config.hooks["afterAgentResponse"] = @($hookEntry)
$config.hooks["stop"] = @($stopEntry)

$json = $config | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($HooksFile, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host "OK: hooks.json -> $HooksFile"
Write-Host "Hook command: cmd /c `"$HookCmd`""
Write-Host "Перезапусти Cursor, открой панель TTS (Start_TTS_Panel.vbs)."
