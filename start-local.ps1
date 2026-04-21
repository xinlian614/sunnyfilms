$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$stdoutLog = Join-Path $projectRoot 'server.stdout.log'
$stderrLog = Join-Path $projectRoot 'server.stderr.log'
$pidFile = Join-Path $projectRoot '.server.pid'

if (Test-Path $pidFile) {
    $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($existingPid) {
        $runningProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
        if ($runningProcess) {
            Write-Host "服务已经在运行，PID: $existingPid"
            Write-Host "访问地址: http://127.0.0.1:3001"
            exit 0
        }
    }
}

if (Test-Path $stdoutLog) {
    Remove-Item -LiteralPath $stdoutLog -Force
}

if (Test-Path $stderrLog) {
    Remove-Item -LiteralPath $stderrLog -Force
}

$process = Start-Process `
    -FilePath 'node' `
    -ArgumentList 'server.js' `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru

$process.Id | Set-Content -LiteralPath $pidFile -Encoding ASCII

Start-Sleep -Seconds 3

$healthUrl = 'http://127.0.0.1:3001/api/health'
try {
    $health = Invoke-WebRequest -UseBasicParsing $healthUrl | Select-Object -ExpandProperty Content
    Write-Host "服务启动成功，PID: $($process.Id)"
    Write-Host "访问地址: http://127.0.0.1:3001"
    Write-Host "健康检查: $health"
    Write-Host "日志文件: $stdoutLog"
} catch {
    Write-Host "服务启动后未通过健康检查，请查看日志："
    Write-Host "标准输出: $stdoutLog"
    Write-Host "错误日志: $stderrLog"
    throw
}
