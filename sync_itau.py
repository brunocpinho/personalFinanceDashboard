import os
import json
import glob
import pandas as pd
from dotenv import load_dotenv
import google.generativeai as genai
import subprocess
import time

# Imports from server.py (assuming sync_itau.py is in the same directory)
from server import extract_text_from_file, get_skill_content, parse_skill_rules, encrypt_data

load_dotenv()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
PASSWORD = os.environ.get("DASHBOARD_PASSWORD")

if not GEMINI_API_KEY:
    print("API KEY not found.")
    exit(1)
if not PASSWORD or PASSWORD == "COLOQUE_SUA_SENHA_AQUI":
    print("ERRO: Senha do dashboard não configurada em .env na variável DASHBOARD_PASSWORD")
    exit(1)

genai.configure(api_key=GEMINI_API_KEY)

ITAU_DIR = r"C:\Users\bruno\OneDrive\Bruno\Documentos pessoais\Financeiro\Itau"
STATE_FILE = r"C:\Users\bruno\Financeiro_Dashboard\sync_itau_state.json"
ONEDRIVE_PATH = r"C:\Users\bruno\OneDrive\Bruno\Documentos pessoais\Financeiro\Financeiro Casal\1 Extratos"
DASHBOARD_DATA_PATH = r"C:\Users\bruno\Financeiro_Dashboard\data"
PUBLICAR_SCRIPT = r"C:\Users\bruno\Financeiro_Dashboard\publicar.ps1"

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"processed_files": {}}

def save_state(state):
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=4)

def process_file(filepath):
    print(f"Lendo conteúdo de {filepath}...")
    with open(filepath, 'rb') as f:
        raw_text = extract_text_from_file(f, os.path.basename(filepath))
        
    skill_text = get_skill_content()
    model = genai.GenerativeModel('gemini-flash-latest')
    
    prompt = f"""
    Você é um agente financeiro encarregado de extrair transações financeiras de um extrato bancário.
    Aqui estão as regras de categorização (SKILL.md):
    
    {skill_text}
    
    Aqui está o conteúdo bruto extraído do arquivo de extrato:
    {raw_text}
    
    Sua tarefa é extrair e classificar CADA transação.
    MUITO IMPORTANTE: A Categoria e a SubCategoria sugeridas DEVEM EXISTIR EXATAMENTE como escritas nas listas "CATEGORIAS E MAPEAMENTO" e "SUBCATEGORIAS PERMITIDAS" da SKILL. 
    MUITO IMPORTANTE 2: Antes de usar a LLM "pura" para adivinhar, consulte primeiro as listas "TERMOS MAPEADOS POR CATEGORIA" e "MAPEAMENTOS APRENDIDOS" na SKILL.
    
    Retorne um array JSON válido contendo objetos com as seguintes chaves exatas (e nada além de JSON):
    "dateStr": Data no formato DD/MM/YYYY.
    "desc": Descrição original limpa.
    "total": O valor numérico (float positivo).
    "origem": Estritamente "Conta Conjunta" ou "Cartao".
    "cat": Categoria EXATA da lista permitida.
    "subcat": Subcategoria EXATA da lista permitida (ou vazio "").
    "dc": D (Débito) ou C (Crédito).
    "ie": I (Interno) ou E (Externo).
    
    APENAS retorne o array JSON.
    """
    
    print("Invocando Gemini para classificação...")
    response = model.generate_content(prompt)
    text_response = response.text.strip()
    
    if text_response.startswith('```'):
        text_response = text_response.split('\n', 1)[1].rsplit('\n', 1)[0]
        
    result_json = json.loads(text_response)
    
    categories, subcategories, learned_mappings = parse_skill_rules(skill_text)
    
    for item in result_json:
        desc_lower = item.get('desc', '').lower()
        cat = item.get('cat', '')
        
        best_match = None
        for term, mapped_cat in learned_mappings.items():
            if term in desc_lower:
                if not best_match or len(term) > len(best_match):
                    best_match = term
                    
        if best_match:
            cat = learned_mappings[best_match]
            item['cat'] = cat
            
        if cat not in categories:
            item['cat'] = 'Outros'
            cat = 'Outros'
            
        subcat = item.get('subcat', '')
        if subcat not in subcategories:
            item['subcat'] = ''
            
        if cat in categories:
            item['dc'] = categories[cat]['dc']
            item['ie'] = categories[cat]['ie']
            
        origem = item.get('origem', '')
        if origem not in ['Conta Conjunta', 'Cartao']:
            item['origem'] = 'Conta Conjunta'
            
    print(f"{len(result_json)} transações categorizadas.")
    return result_json

def append_to_tsv(transactions):
    # Agrupa por YYYYMM
    grouped = {}
    for t in transactions:
        parts = t.get('dateStr', '').split('/')
        if len(parts) == 3:
            mm = parts[1].zfill(2)
            yyyy = parts[2]
            key = f"{yyyy}{mm}"
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(t)
            
    for yyyymm, txs in grouped.items():
        year = yyyymm[:4]
        month = yyyymm[4:]
        filename = f"{yyyymm}.tsv"
        onedrive_year_dir = os.path.join(ONEDRIVE_PATH, year)
        os.makedirs(onedrive_year_dir, exist_ok=True)
        onedrive_file = os.path.join(onedrive_year_dir, filename)
        
        existing_lines = []
        if os.path.exists(onedrive_file):
            with open(onedrive_file, 'r', encoding='utf-8') as f:
                existing_lines = f.read().strip().split('\n')
                if existing_lines == ['']: existing_lines = []
                
        existing_set = set(existing_lines)
        appended_count = 0
        
        for t in txs:
            valor_str = f"{float(t['total']):.2f}".replace('.', ',')
            row = [
                t.get('dateStr', ''),
                t.get('desc', ''),
                valor_str,
                t.get('origem', ''),
                t.get('cat', ''),
                t.get('subcat', ''),
                t.get('dc', ''),
                t.get('ie', ''),
                t.get('subcat', '')
            ]
            line = '\t'.join(row)
            if line not in existing_set:
                existing_lines.append(line)
                existing_set.add(line)
                appended_count += 1
                
        if appended_count > 0:
            print(f"Adicionando {appended_count} novas transações em {filename}...")
            tsv_content = '\n'.join(existing_lines)
            
            # Save TSV
            with open(onedrive_file, 'w', encoding='utf-8') as f:
                f.write(tsv_content)
                
            # Encrypt
            enc_content = encrypt_data(tsv_content, PASSWORD)
            enc_dir = os.path.join(DASHBOARD_DATA_PATH, year)
            os.makedirs(enc_dir, exist_ok=True)
            
            enc_file = os.path.join(enc_dir, f"{yyyymm}.enc")
            with open(enc_file, 'w', encoding='utf-8') as f:
                f.write(enc_content)
            print(f"Salvo e criptografado: {enc_file}")
        else:
            print(f"Nenhuma transação nova para {filename} (todas já existiam no TSV).")

def main():
    print("Iniciando sincronização diária do Itaú...")
    state = load_state()
    processed = state.get("processed_files", {})
    
    files = []
    if os.path.exists(ITAU_DIR):
        files = glob.glob(os.path.join(ITAU_DIR, '**', '*.*'), recursive=True)
        
    import datetime
    cutoff_time = datetime.datetime(2026, 8, 1).timestamp()
    
    any_new = False
    for fp in files:
        if os.path.isfile(fp):
            mtime = os.path.getmtime(fp)
            basename = os.path.basename(fp)
            if mtime >= cutoff_time and (basename not in processed or processed[basename] < mtime):
                print(f"\n--- Processando arquivo novo/alterado: {basename} ---")
                try:
                    transactions = process_file(fp)
                    if transactions:
                        append_to_tsv(transactions)
                    processed[basename] = mtime
                    any_new = True
                except Exception as e:
                    print(f"Erro ao processar {basename}: {e}")
                    
    state["processed_files"] = processed
    save_state(state)
    
    if any_new:
        print("\nAlterações processadas com sucesso. Publicando no GitHub...")
        subprocess.run(["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", PUBLICAR_SCRIPT], 
                       cwd=os.path.dirname(PUBLICAR_SCRIPT))
        print("Sincronização e publicação concluídas!")
    else:
        print("\nNenhum arquivo novo para processar.")

if __name__ == '__main__':
    main()
