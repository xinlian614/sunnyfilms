$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectRoot '.server.pid'

if (-not (Test-Path $pidFile)) {
    Write-Host '没有找到 PID 文件，服务可能未启动。'
    exit 0
}

$pidValue = Get-Content $pidFile -ErrorAction SilentlyContinue
if (-not $pidValue) {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host 'PID 文件为空，已清理。'
    exit 0
}

$process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
if (-not $process) {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host "进程 $pidValue 不存在，已清理 PID 文件。"
    exit 0
}

Stop-Process -Id $pidValue -Force
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "服务已停止，PID: $pidValue"
