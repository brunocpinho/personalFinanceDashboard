# ============================================================
# publicar.ps1 - Criptografa os dados e publica no GitHub Pages
# ============================================================

# Token lido de variavel de ambiente ou arquivo local (nao commitado)
$tokenFile = Join-Path $PSScriptRoot ".gh_token"
if (Test-Path $tokenFile) {
    $token = (Get-Content $tokenFile -Raw).Trim()
} elseif ($env:GH_TOKEN) {
    $token = $env:GH_TOKEN
} else {
    Write-Host "Token GitHub nao encontrado." -ForegroundColor Red
    Write-Host "Crie o arquivo .gh_token em C:\Users\bruno\Financeiro_Dashboard\ com seu token." -ForegroundColor Yellow
    exit 1
}

$repoName  = "personalFinanceDashboard"
$username  = "brunocpinho"
$git       = "C:\Program Files\Git\cmd\git.exe"
$dashDir   = "C:\Users\bruno\Financeiro_Dashboard"
$extratos  = "C:\Users\bruno\OneDrive\Bruno\Documentos pessoais\Financeiro\Financeiro Casal\1 Extratos"
$dataDir   = Join-Path $dashDir "data"

Set-Location -Path $dashDir

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Dashboard Financeiro - Publicar" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Copia TSVs de todos os anos de Extratos para data/
Write-Host ""
Write-Host "Copiando TSVs para pasta data/..." -ForegroundColor Gray
$anos = Get-ChildItem -Path $extratos -Directory
foreach ($ano in $anos) {
    $destAno = Join-Path $dataDir $ano.Name
    New-Item -ItemType Directory -Force -Path $destAno | Out-Null
    $tsvs = Get-ChildItem -Path $ano.FullName -Filter "*.tsv"
    foreach ($tsv in $tsvs) {
        Copy-Item -Path $tsv.FullName -Destination $destAno -Force
    }
    if ($tsvs.Count -gt 0) {
        $count = $tsvs.Count
        Write-Host ("  Copiado: {0} ({1} arquivos)" -f $ano.Name, $count) -ForegroundColor Gray
    }
}

# Criptografa
Write-Host ""
Write-Host "Criptografando dados..." -ForegroundColor Gray
python encrypt_data.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro na criptografia. Publicacao cancelada." -ForegroundColor Red
    exit 1
}

# Git commit e push
Write-Host ""
Write-Host "Publicando no GitHub..." -ForegroundColor Gray
& $git init
& $git add .
& $git config user.name "Bruno Pinho"
& $git config user.email "brunocpinho@example.com"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
& $git commit -m "Atualizacao dashboard - $timestamp"
& $git branch -M main

$headers = @{
    "Authorization" = "token $token"
    "Accept"        = "application/vnd.github.v3+json"
}
$body = @{ "name" = $repoName; "private" = $false } | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body $body | Out-Null
} catch {}

$remoteUrl = "https://$($username):$($token)@github.com/$username/$repoName.git"
& $git remote remove origin 2>$null
& $git remote add origin $remoteUrl
& $git push -u origin main -f

# Garante Pages ativo
$pagesBody = @{ "source" = @{ "branch" = "main"; "path" = "/" } } | ConvertTo-Json
try {
    Start-Sleep -Seconds 3
    Invoke-RestMethod -Uri "https://api.github.com/repos/$username/$repoName/pages" -Method Post -Headers $headers -Body $pagesBody | Out-Null
} catch {}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Publicado com sucesso!" -ForegroundColor Green
Write-Host "  URL: https://$username.github.io/$repoName" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
