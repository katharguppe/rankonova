# wsl-repair.ps1 -- WSL2 / Docker Desktop disk repair + corruption prevention
# Run in an ELEVATED PowerShell (right-click -> Run as Administrator)
# Usage: .\scripts\wsl-repair.ps1

param(
    [switch]$RepairOnly,   # skip the checklist, just repair
    [switch]$CheckOnly     # skip repair, just show checklist
)

function Write-Header($text) {
    Write-Host ""
    Write-Host "=== $text ===" -ForegroundColor Cyan
}

# -- Step 1: Shutdown WSL cleanly ---------------------------------------------
if (-not $CheckOnly) {
    Write-Header "Step 1 -- Shutting down WSL2"
    wsl --shutdown
    Start-Sleep -Seconds 3
    Write-Host "WSL2 stopped." -ForegroundColor Green
}

# -- Step 2: Repair Docker's ext4 virtual disk --------------------------------
if (-not $CheckOnly) {
    Write-Header "Step 2 -- Repairing Docker ext4 virtual disk"
    Write-Host "Running e2fsck on /dev/sdb inside docker-desktop distro..."

    $result = wsl -d docker-desktop -e e2fsck -y /dev/sdb 2>&1
    if ($LASTEXITCODE -le 1) {
        # e2fsck exit 0 = no errors, exit 1 = errors corrected -- both are success
        Write-Host "Disk repair complete." -ForegroundColor Green
        Write-Host $result
    } else {
        Write-Host "e2fsck returned exit code $LASTEXITCODE -- disk may need a full reset." -ForegroundColor Yellow
        Write-Host $result
        Write-Host ""
        Write-Host "If errors persist, run inside Docker Desktop:" -ForegroundColor Yellow
        Write-Host "  Settings -> Troubleshoot -> Clean / Purge data" -ForegroundColor Yellow
        Write-Host "  (WARNING: destroys all containers, images, volumes)" -ForegroundColor Red
    }
}

# -- Step 3: Compact the VHDX (reclaim disk space) ----------------------------
if (-not $CheckOnly) {
    Write-Header "Step 3 -- Compacting ext4.vhdx"

    $vhdxPath = "$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx"
    if (Test-Path $vhdxPath) {
        $sizeBefore = [math]::Round((Get-Item $vhdxPath).Length / 1GB, 2)
        Write-Host "VHDX size before: $sizeBefore GB"

        # Compact requires the disk to be detached (WSL is already shut down)
        $diskpartScript = @"
select vdisk file="$vhdxPath"
attach vdisk readonly
compact vdisk
detach vdisk
exit
"@
        $tmpFile = [System.IO.Path]::GetTempFileName() + ".txt"
        $diskpartScript | Out-File -FilePath $tmpFile -Encoding ascii
        diskpart /s $tmpFile | Out-Null
        Remove-Item $tmpFile -ErrorAction SilentlyContinue

        $sizeAfter = [math]::Round((Get-Item $vhdxPath).Length / 1GB, 2)
        Write-Host "VHDX size after:  $sizeAfter GB" -ForegroundColor Green
    } else {
        Write-Host "ext4.vhdx not found at expected path -- skipping compact." -ForegroundColor Yellow
        Write-Host "Path checked: $vhdxPath"
    }
}

# -- Checklist: permanent prevention ------------------------------------------
if (-not $RepairOnly) {
    Write-Header "Permanent Prevention Checklist"

    Write-Host ""
    Write-Host "  [1] Disable Windows Fast Startup (REQUIRED)" -ForegroundColor Yellow
    Write-Host "      Control Panel -> Power Options -> 'Choose what the power buttons do'"
    Write-Host "      -> Uncheck 'Turn on fast startup (recommended)' -> Save changes"
    Write-Host ""
    Write-Host "  [2] Before sleep or shutdown, always run:" -ForegroundColor Yellow
    Write-Host "      wsl --shutdown" -ForegroundColor White
    Write-Host "      (3 seconds -- cleanly unmounts the ext4 filesystem)"
    Write-Host ""
    Write-Host "  [3] .wslconfig is configured with stability settings:" -ForegroundColor Green
    Write-Host "      sparse=true              (VHDX auto-shrinks, prevents disk-full corruption)"
    Write-Host "      autoMemoryReclaim=gradual (WSL2 returns memory to Windows gradually)"
    Write-Host "      kernelCommandLine=vsyscall=emulate (prevents rare kernel panics)"
    Write-Host ""
    Write-Host "  [4] Local dev workflow (avoids bind-mount I/O entirely):" -ForegroundColor Green
    Write-Host "      docker compose up postgres redis -d"
    Write-Host "      npm run start:dev"
    Write-Host ""
}

Write-Header "Done"
Write-Host "Restart Docker Desktop and verify with: docker compose up postgres redis -d"
Write-Host ""
