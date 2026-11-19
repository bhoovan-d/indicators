# Daily thali scrape, run from this PC because data.gov.in blocks GitHub's servers.
# Registered as the Windows scheduled task "India Pulse thali" (see README). Output goes to thali.log.
Set-Location $PSScriptRoot
$env:PYTHONIOENCODING = "utf-8"
Start-Transcript -Path (Join-Path $PSScriptRoot "thali.log") -Append | Out-Null
try {
    "== $(Get-Date -Format 'yyyy-MM-dd HH:mm') =="
    git pull --rebase --autostash --quiet
    if ($LASTEXITCODE -ne 0) { throw "git pull failed" }

    & "$PSScriptRoot\.venv\Scripts\python.exe" scrape.py --only-thali
    if ($LASTEXITCODE -ne 0) { throw "scrape failed" }

    git add public/data/thali.json
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        git commit --quiet -m "data: thali $(Get-Date -Format 'yyyy-MM-dd HH:mm') IST"
        git push --quiet
        if ($LASTEXITCODE -ne 0) { throw "git push failed" }
        "pushed"
    } else { "no change" }
} catch {
    "ERROR: $_"
} finally {
    Stop-Transcript | Out-Null
}
