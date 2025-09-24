if (Test-Path -Path "server") {
    git rm -r server
    if ($LASTEXITCODE -ne 0) {
        Write-Host "git rm failed. Remove server/ manually and commit the change." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "server/ removed. Commit the change: git commit -m 'chore: remove internal server'"
} else {
    Write-Host "server/ not found"
}
