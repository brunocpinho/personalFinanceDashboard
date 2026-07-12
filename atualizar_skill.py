"""
atualizar_skill.py — Detecta mudancas nos TSVs (comparando com .bak) e
atualiza automaticamente a SKILL.md com os novos mapeamentos aprendidos.

Uso: python atualizar_skill.py <pasta_extratos>
"""
import sys, os, re, glob

SKILL_PATH = r"C:\Users\bruno\.agents\skills\categorizador_financeiro\SKILL.md"
SECAO_APRENDIDO = "## MAPEAMENTOS APRENDIDOS"
SECAO_NOVAS = "## CORRECOES MANUAIS APLICADAS"

extratos_dir = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\bruno\OneDrive\Bruno\Documentos pessoais\Financeiro\Financeiro Casal\1 Extratos\2026"

def ler_tsv(path):
    """Retorna lista de dicts por linha."""
    rows = []
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            parts = line.rstrip('\n').split('\t')
            if len(parts) == 9:
                rows.append({
                    'data': parts[0], 'desc': parts[1], 'valor': parts[2],
                    'origem': parts[3], 'cat': parts[4], 'subcat': parts[5],
                    'dc': parts[6], 'ie': parts[7], 'subcat_orig': parts[8]
                })
    return rows

def chave(row):
    return f"{row['data']}||{row['desc']}||{row['valor']}"

def extrair_padrao(desc):
    """Extrai um padrao curto e util da descricao para adicionar na SKILL."""
    desc = desc.strip()
    # Remove sufixos de cidade/pais comuns do Itau
    desc = re.sub(r'\s+(belo horizont|sao paulo|rio de janeir|br|cl|mx|pa|us)\s*$', '', desc, flags=re.IGNORECASE).strip()
    # Remove codigos alfanumericos no final
    desc = re.sub(r'\s+\*?\w{6,}\s*$', '', desc).strip()
    # Pega os primeiros 30 chars como padrao
    padrao = desc[:35].strip()
    return padrao

def ler_skill():
    with open(SKILL_PATH, encoding='utf-8') as f:
        return f.read()

def salvar_skill(conteudo):
    with open(SKILL_PATH, 'w', encoding='utf-8') as f:
        f.write(conteudo)

def categoria_ja_existe(skill_text, padrao):
    """Verifica se o padrao ja esta mapeado em alguma categoria."""
    return padrao.lower() in skill_text.lower()

def adicionar_a_skill(skill_text, categoria, padrao):
    """Adiciona padrao na secao correta da SKILL (MAPEAMENTOS APRENDIDOS)."""
    # Procura linha '- **Categoria**: ...' nas secoes de aprendizado
    linha_cat = f"- **{categoria}**:"
    linhas = skill_text.split('\n')
    
    for i, linha in enumerate(linhas):
        if linha.startswith(linha_cat) and i > skill_text.count('\n') // 2:
            # Adiciona ao final da linha existente
            if padrao not in linhas[i]:
                linhas[i] = linhas[i].rstrip() + f", {padrao}"
            return '\n'.join(linhas)
    
    # Nao encontrou a categoria na secao de aprendizado — cria nova entrada
    # Procura o final do arquivo para inserir
    insert_idx = len(linhas) - 1
    # Tenta inserir na secao CORRECOES MANUAIS se existir
    for i, linha in enumerate(linhas):
        if SECAO_NOVAS in linha:
            insert_idx = i + 1
            break
    else:
        # Cria secao se nao existir
        linhas.append(f"\n{SECAO_NOVAS}")
        linhas.append(f"- **{categoria}**: {padrao}")
        return '\n'.join(linhas)
    
    linhas.insert(insert_idx, f"- **{categoria}**: {padrao}")
    return '\n'.join(linhas)

def remover_de_categoria_errada(skill_text, padrao, cat_errada):
    """Remove o padrao da categoria incorreta se ele estiver la."""
    if not padrao or not cat_errada:
        return skill_text
    linhas = skill_text.split('\n')
    linha_cat = f"- **{cat_errada}**:"
    for i, linha in enumerate(linhas):
        if linha.startswith(linha_cat) and padrao.lower() in linha.lower():
            # Remove o padrao da lista
            nova = re.sub(r',?\s*' + re.escape(padrao) + r'\s*,?', ',', linha, flags=re.IGNORECASE)
            nova = nova.replace(',,', ',').rstrip(',').strip()
            linhas[i] = nova
    return '\n'.join(linhas)

# ── Detecta mudancas ──────────────────────────────────────────────────────────
mudancas = []  # (desc, cat_antiga, cat_nova)

for tsv_path in sorted(glob.glob(os.path.join(extratos_dir, '*.tsv'))):
    bak_path = tsv_path + '.bak'
    if not os.path.exists(bak_path):
        continue
    
    original = {chave(r): r for r in ler_tsv(bak_path)}
    editado  = {chave(r): r for r in ler_tsv(tsv_path)}
    
    for k, row_novo in editado.items():
        if k in original:
            row_orig = original[k]
            if row_novo['cat'] != row_orig['cat']:
                mudancas.append({
                    'desc': row_novo['desc'],
                    'cat_antiga': row_orig['cat'],
                    'cat_nova': row_novo['cat'],
                    'arquivo': os.path.basename(tsv_path)
                })

if not mudancas:
    print("Nenhuma mudanca de categoria detectada.")
    sys.exit(0)

print(f"\n{len(mudancas)} mudanca(s) de categoria detectada(s):")
for m in mudancas:
    print(f"  [{m['arquivo']}] '{m['desc'][:50]}' : {m['cat_antiga']} -> {m['cat_nova']}")

# ── Atualiza SKILL ────────────────────────────────────────────────────────────
skill = ler_skill()
atualizadas = 0

for m in mudancas:
    padrao = extrair_padrao(m['desc'])
    if not padrao or len(padrao) < 4:
        print(f"  Padrao muito curto, ignorado: '{padrao}'")
        continue
    
    if categoria_ja_existe(skill, padrao):
        print(f"  Padrao ja existe na SKILL: '{padrao}' — verificando categoria...")
        skill = remover_de_categoria_errada(skill, padrao, m['cat_antiga'])
        skill = adicionar_a_skill(skill, m['cat_nova'], padrao)
    else:
        skill = adicionar_a_skill(skill, m['cat_nova'], padrao)
        print(f"  Adicionado na SKILL: '{padrao}' -> {m['cat_nova']}")
    
    atualizadas += 1

salvar_skill(skill)
print(f"\nSKILL.md atualizada com {atualizadas} novo(s) mapeamento(s).")
