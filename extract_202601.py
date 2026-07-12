import pandas as pd
import os
import sys

file_path = r'C:\Users\bruno\OneDrive\Bruno\Documentos pessoais\Financeiro\Financeiro Casal\5 Planilha Financeira\FinanceiroCasal.xlsx'
out_path = r'C:\Users\bruno\OneDrive\Bruno\Documentos pessoais\Financeiro\Financeiro Casal\1 Extratos\2026\202601.tsv'

print("Lendo arquivo Excel...")
try:
    df = pd.read_excel(file_path, sheet_name='Lancamentos')
except Exception as e:
    print(f"Erro ao ler Excel: {e}")
    sys.exit(1)

# Renomeando colunas problematicas com acentos
df.columns = [c.replace('ç', 'c').replace('ã', 'a').replace('ê', 'e') for c in df.columns]

# Encontrar a coluna de Mês e Ano, podem ter vindo com acentos estranhos
col_mes = [c for c in df.columns if 'm' in c.lower() and 's' in c.lower() and len(c) <= 4]
col_mes = col_mes[0] if col_mes else 'Mes'
col_ano = [c for c in df.columns if 'ano' in c.lower()]
col_ano = col_ano[0] if col_ano else 'Ano'
col_desc = [c for c in df.columns if 'descri' in c.lower() and 'alt' not in c.lower() and 'valor' not in c.lower()]
col_desc = col_desc[0] if col_desc else 'Descricao'

print(f"Filtrando Ano=2026 e Mes=1 (usando colunas {col_ano} e {col_mes})...")
df_202601 = df[(df[col_ano] == 2026) & (df[col_mes] == 1)]

print(f"Foram encontrados {len(df_202601)} registros para Janeiro de 2026.")

out_rows = []
for idx, row in df_202601.iterrows():
    # 1. Data (DD/MM/YYYY)
    d = row['Data']
    if pd.isna(d): continue
    try:
        data_str = d.strftime('%d/%m/%Y')
    except:
        data_str = str(d)[:10].replace('-', '/')
        parts = data_str.split('/')
        if len(parts) == 3 and len(parts[0]) == 4:
            data_str = f"{parts[2]}/{parts[1]}/{parts[0]}"
    
    # 2. Descrição
    desc = str(row[col_desc]).strip() if pd.notna(row[col_desc]) else ""
    
    # 3. Valor
    val = row['Total']
    if pd.isna(val): val = 0
    val_str = f"{abs(float(val)):.2f}".replace('.', ',')
    
    # 4. Origem
    origem = str(row['Origem']).strip() if pd.notna(row['Origem']) else ""
    
    # 5. Categoria
    cat = str(row['Categoria']).strip() if pd.notna(row['Categoria']) else ""
    
    # 6. SubCategoria
    subcat = str(row['SubCategoria']).strip() if 'SubCategoria' in df.columns and pd.notna(row['SubCategoria']) else ""
    
    # 7. D/C
    dc = str(row['D/C']).strip().upper() if 'D/C' in df.columns and pd.notna(row['D/C']) else ("D" if float(val) < 0 else "C")
    
    # 8. I/E
    # Vamos inferir baseado na categoria como estava na skill
    ie = 'E' if cat.lower() in ['custos fixos', 'alimentação', 'saúde', 'impostos'] else 'I'
    
    # 9. subcat_orig
    subcat_orig = str(row['Categoria Excel']).strip() if 'Categoria Excel' in df.columns and pd.notna(row['Categoria Excel']) else ""
    
    row_tsv = f"{data_str}\t{desc}\t{val_str}\t{origem}\t{cat}\t{subcat}\t{dc}\t{ie}\t{subcat_orig}\n"
    out_rows.append(row_tsv)

with open(out_path, 'w', encoding='utf-8') as f:
    f.writelines(out_rows)

print(f"Salvo {len(out_rows)} registros em {out_path}")
