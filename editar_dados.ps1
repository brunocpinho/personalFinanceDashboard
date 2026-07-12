# editar_dados.ps1 - Abre TSVs para edicao manual no Excel
# Apos salvar, detecta mudancas e atualiza a SKILL automaticamente

$extratos = "C:\Users\bruno\OneDrive\Bruno\Documentos pessoais\Financeiro\Financeiro Casal\1 Extratos\2026"
$dashDir  = "C:\Users\bruno\Financeiro_Dashboard"
$skillPy  = Join-Path $dashDir "atualizar_skill.py"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Dashboard Financeiro - Editor de Dados" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pasta de extratos: $extratos" -ForegroundColor Gray
Write-Host ""

# Lista meses disponiveis
$arquivos = Get-ChildItem -Path $extratos -Filter "*.tsv" | Sort-Object Name
if ($arquivos.Count -eq 0) {
    Write-Host "Nenhum arquivo TSV encontrado em $extratos" -ForegroundColor Red
    exit 1
}

Write-Host "Meses disponiveis:"
foreach ($f in $arquivos) {
    $mes = $f.BaseName
    $numLinhas = (Get-Content $f.FullName | Measure-Object -Line).Lines
    Write-Host "  $mes  ($numLinhas transacoes)" -ForegroundColor White
}

Write-Host ""
$escolha = Read-Host "Digite o mes para editar (ex: 202606) ou 'todos'"

# Seleciona arquivos
if ($escolha -eq "todos") {
    $selecionados = $arquivos
} else {
    $selecionados = $arquivos | Where-Object { $_.BaseName -eq $escolha }
    if ($null -eq $selecionados -or @($selecionados).Count -eq 0) {
        Write-Host "Mes '$escolha' nao encontrado." -ForegroundColor Red
        exit 1
    }
}
$selecionados = @($selecionados)

# Faz backup dos arquivos selecionados
Write-Host ""
Write-Host "Fazendo backup dos arquivos..." -ForegroundColor Gray
foreach ($f in $selecionados) {
    $bak = $f.FullName + ".bak"
    Copy-Item -Path $f.FullName -Destination $bak -Force
    Write-Host "  Backup: $($f.Name).bak" -ForegroundColor Gray
}

# Abre cada arquivo no Excel (ou editor padrao para .tsv)
Write-Host ""
Write-Host "Abrindo arquivos para edicao..." -ForegroundColor Cyan
foreach ($f in $selecionados) {
    Start-Process $f.FullName
    Start-Sleep -Milliseconds 400
}

# Abre Explorer na pasta
Start-Process explorer.exe $extratos

Write-Host ""
Write-Host "================================================" -ForegroundColor Yellow
Write-Host "  Edite as categorias no Excel." -ForegroundColor Yellow
Write-Host "  IMPORTANTE: Salve como TSV (nao mude formato)." -ForegroundColor Yellow
Write-Host "  Quando terminar, feche o Excel e pressione Enter." -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Yellow
Read-Host

# Valida formato dos TSVs editados (deve ter 9 colunas separadas por tab)
Write-Host ""
Write-Host "Validando formato dos arquivos..." -ForegroundColor Gray
$erros = 0
foreach ($f in $selecionados) {
    $conteudo = Get-Content $f.FullName -Encoding UTF8
    $linhaNum = 0
    $erroArq = 0
    foreach ($linha in $conteudo) {
        $linhaNum++
        if ($linha.Trim() -eq "") { continue }
        $cols = $linha.Split("`t")
        if ($cols.Count -ne 9) {
            Write-Host "  ERRO em $($f.Name) linha ${linhaNum}: $($cols.Count) colunas (esperado 9)" -ForegroundColor Red
            $erros++
            $erroArq++
        }
    }
    if ($erroArq -eq 0) {
        Write-Host "  OK: $($f.Name)" -ForegroundColor Green
    }
}

if ($erros -gt 0) {
    Write-Host ""
    Write-Host "Erros de formato detectados. Restaurando backups..." -ForegroundColor Red
    foreach ($f in $selecionados) {
        $bak = $f.FullName + ".bak"
        if (Test-Path $bak) {
            Copy-Item -Path $bak -Destination $f.FullName -Force
            Write-Host "  Restaurado: $($f.Name)" -ForegroundColor Yellow
        }
    }
    Write-Host "Corrija o arquivo e rode o script novamente." -ForegroundColor Red
    exit 1
}

# Atualiza a SKILL com as mudancas detectadas
Write-Host ""
Write-Host "Detectando mudancas e atualizando SKILL..." -ForegroundColor Cyan
python $skillPy $extratos

# Remove backups apos sucesso
foreach ($f in $selecionados) {
    $bak = $f.FullName + ".bak"
    if (Test-Path $bak) { Remove-Item $bak -Force }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Edicao concluida com sucesso!" -ForegroundColor Green
Write-Host "  Para publicar no Dashboard, execute:" -ForegroundColor Green
Write-Host "    .\publicar.ps1" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
