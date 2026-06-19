$target = "D:\project\pythonProject\homework\AutoDocxProofread\out"
$maxAttempts = 12
$delaySec = 5
for ($i = 1; $i -le $maxAttempts; $i++) {
    if (-not (Test-Path $target)) {
        Write-Output "SUCCESS: out directory removed"
        exit 0
    }
    try {
        Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
        Write-Output "SUCCESS: out directory removed on attempt $i"
        exit 0
    } catch {
        Write-Output "Attempt ${i}/${maxAttempts} failed: $($_.Exception.Message)"
        Start-Sleep -Seconds $delaySec
    }
}
Write-Output "FAILED: could not remove out after $maxAttempts attempts"
exit 1
