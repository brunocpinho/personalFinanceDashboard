import os
import io
import json
import base64
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import google.generativeai as genai
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import traceback
from dotenv import load_dotenv

load_dotenv()  # Carrega variáveis do arquivo .env

app = Flask(__name__)
CORS(app)  # Permite chamadas do frontend (localhost)

# Configura o Gemini (tenta pegar da variável de ambiente, comum na máquina local do usuário)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("AVISO: GEMINI_API_KEY ou GOOGLE_API_KEY não encontrada no ambiente.")

SKILL_PATH = r"C:\Users\bruno\.agents\skills\categorizador_financeiro\SKILL.md"
ONEDRIVE_PATH = r"C:\Users\bruno\OneDrive\Bruno\Documentos pessoais\Financeiro\Financeiro Casal\1 Extratos"
DASHBOARD_DATA_PATH = r"C:\Users\bruno\Financeiro_Dashboard\data"
PUBLICAR_SCRIPT = r"C:\Users\bruno\Financeiro_Dashboard\publicar.ps1"

def extract_text_from_file(file_obj, filename):
    """Extrai texto bruto ou tabulado do arquivo dependendo da extensão."""
    ext = filename.lower().split('.')[-1]
    
    if ext == 'csv':
        df = pd.read_csv(file_obj, sep=None, engine='python')
        return df.to_string()
    elif ext in ['xls', 'xlsx']:
        df = pd.read_excel(file_obj)
        return df.to_string()
    elif ext == 'pdf':
        try:
            import pdfplumber
            text = ""
            with pdfplumber.open(file_obj) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() + "\n"
            return text
        except ImportError:
            return "Erro: pdfplumber não instalado. Execute: pip install pdfplumber"
    else:
        # Tenta ler como texto plano (OFX, TXT, etc)
        return file_obj.read().decode('utf-8', errors='ignore')

def get_skill_content():
    try:
        with open(SKILL_PATH, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Erro ao ler SKILL.md: {str(e)}"

import re
def parse_skill_rules(skill_text):
    categories = {}
    subcategories = []
    learned_mappings = {}

    cat_pattern = r'-\s*([A-Za-zÀ-ÿ0-9\s()]+?)\s*\(([DC]),\s*([IE])\)'
    for match in re.finditer(cat_pattern, skill_text):
        cat = match.group(1).strip()
        dc = match.group(2)
        ie = match.group(3)
        categories[cat] = {'dc': dc, 'ie': ie}
        
    subcat_section = re.search(r'## SUBCATEGORIAS PERMITIDAS(.*?)(?=## |\Z)', skill_text, re.DOTALL)
    if subcat_section:
        for line in subcat_section.group(1).split('\n'):
            line = line.strip()
            if line.startswith('-'):
                subcategories.append(line[1:].strip())
                
    mapping_pattern = r'-\s*\*\*([^*]+)\*\*\s*:\s*(.+)'
    for match in re.finditer(mapping_pattern, skill_text):
        cat = match.group(1).strip()
        terms = match.group(2).split(',')
        for term in terms:
            term = term.strip()
            if not term: continue
            if 'CORRIGIDO' in term.upper() or '->' in term or '(→' in term:
                base_term = re.split(r'->|\(→', term)[0].strip()
                learned_mappings[base_term.lower()] = cat 
            else:
                learned_mappings[term.lower()] = cat

    return categories, subcategories, learned_mappings

def encrypt_data(text, password):
    """Criptografa o texto usando AES-GCM (mesmo padrão do app.js)."""
    salt = os.urandom(16)
    iv = os.urandom(12)
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = kdf.derive(password.encode('utf-8'))
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(iv, text.encode('utf-8'), None)
    
    final_bytes = salt + iv + ciphertext
    return base64.b64encode(final_bytes).decode('utf-8')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Nenhum arquivo selecionado"}), 400

    try:
        # Extrai o texto do arquivo
        raw_text = extract_text_from_file(file, file.filename)
        
        # Lê as regras (Skill)
        skill_text = get_skill_content()
        
        # Verifica se temos a chave API configurada
        if not GEMINI_API_KEY:
            return jsonify({"error": "Chave API do Gemini não configurada! Por favor, crie uma variável de ambiente do Windows chamada 'GOOGLE_API_KEY' com a sua chave, feche e abra novamente o terminal onde o servidor está rodando."}), 400
            
        # Chama a LLM
        model = genai.GenerativeModel('gemini-flash-latest')
        
        prompt = f"""
        Você é um agente financeiro encarregado de extrair transações financeiras de um extrato bancário.
        Aqui estão as regras de categorização (SKILL.md):
        
        {skill_text}
        
        Aqui está o conteúdo bruto extraído do arquivo de extrato:
        {raw_text}
        
        Sua tarefa é extrair e classificar CADA transação.
        MUITO IMPORTANTE: A Categoria e a SubCategoria sugeridas DEVEM EXISTIR EXATAMENTE como escritas nas listas "CATEGORIAS E MAPEAMENTO" e "SUBCATEGORIAS PERMITIDAS" da SKILL. 
        MUITO IMPORTANTE 2: Antes de usar a LLM "pura" para adivinhar, consulte primeiro as listas "TERMOS MAPEADOS POR CATEGORIA" e "MAPEAMENTOS APRENDIDOS" na SKILL para garantir a integridade dos dados baseada no histórico. Se uma descrição se assemelhar a algo lá mapeado, use a categoria definida.
        
        Retorne um array JSON válido contendo objetos com as seguintes chaves exatas (e nada além de JSON):
        "dateStr": Data no formato DD/MM/YYYY.
        "desc": Descrição original limpa.
        "total": O valor numérico (float positivo).
        "origem": Estritamente "Conta Conjunta" ou "Cartão" (se for de fatura/cartão de crédito use Cartão, se for de extrato de conta corrente use Conta Conjunta).
        "cat": Categoria EXATA da lista permitida.
        "subcat": Subcategoria EXATA da lista permitida (ou vazio "").
        "dc": D (Débito) ou C (Crédito), rigorosamente extraído da lista de Categorias da SKILL.
        "ie": I (Interno) ou E (Externo), rigorosamente extraído da lista de Categorias da SKILL.
        
        APENAS retorne o array JSON.
        """
        
        response = model.generate_content(prompt)
        text_response = response.text.strip()
        
        if text_response.startswith('```'):
            text_response = text_response.split('\n', 1)[1].rsplit('\n', 1)[0]
            
        result_json = json.loads(text_response)
        
        # Post-process and enforce integrity against SKILL
        categories, subcategories, learned_mappings = parse_skill_rules(skill_text)
        
        for item in result_json:
            desc_lower = item.get('desc', '').lower()
            cat = item.get('cat', '')
            
            # 1. Match description to learned mappings (override LLM)
            best_match = None
            for term, mapped_cat in learned_mappings.items():
                if term in desc_lower:
                    if not best_match or len(term) > len(best_match):
                        best_match = term
                        
            if best_match:
                cat = learned_mappings[best_match]
                item['cat'] = cat
                
            # 2. Enforce valid category
            if cat not in categories:
                item['cat'] = 'Outros'
                cat = 'Outros'
                
            # 3. Enforce valid subcategory
            subcat = item.get('subcat', '')
            if subcat not in subcategories:
                item['subcat'] = ''
                
            # 4. Enforce strict D/C and I/E based on SKILL category list
            if cat in categories:
                item['dc'] = categories[cat]['dc']
                item['ie'] = categories[cat]['ie']
                
            # 5. Enforce allowed origin
            origem = item.get('origem', '')
            if origem not in ['Conta Conjunta', 'Cartão']:
                # Default to Conta Conjunta if LLM hallucinates
                item['origem'] = 'Conta Conjunta'
        
        return jsonify(result_json)
        
    except Exception as e:
        with open("server_error.log", "a", encoding="utf-8") as err_file:
            err_file.write(traceback.format_exc() + "\n")
            
        response = jsonify({"error": str(e)})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 500

@app.route('/api/save', methods=['POST'])
def save_data():
    data = request.json
    year = data.get('year')
    month = data.get('month')
    password = data.get('password')
    transactions = data.get('data')
    
    if not all([year, month, password, transactions is not None]):
        return jsonify({"error": "Dados incompletos fornecidos."}), 400
        
    try:
        # 1. Montar o texto TSV com a nova estrutura de 9 colunas
        # Colunas: Data, Descrição, Valor, Origem, Categoria, SubCategoria, D/C, I/E, SubcatOrig
        tsv_lines = []
        for t in transactions:
            # Formata o valor com 2 casas decimais e vírgula
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
                t.get('subcat', '') # Subcat Orig -> igual à subcat pois foi validada
            ]
            tsv_lines.append('\t'.join(row))
            
        tsv_content = '\n'.join(tsv_lines)
        filename = f"{year}{month.zfill(2)}.tsv"
        
        # 2. Sincronizar com o OneDrive (Cópia limpa/Single Source of Truth)
        if os.path.exists(ONEDRIVE_PATH):
            onedrive_year_dir = os.path.join(ONEDRIVE_PATH, year)
            os.makedirs(onedrive_year_dir, exist_ok=True)
            onedrive_file = os.path.join(onedrive_year_dir, filename)
            with open(onedrive_file, 'w', encoding='utf-8') as f:
                f.write(tsv_content)
        
        # 3. Gerar arquivo criptografado no Dashboard
        enc_content = encrypt_data(tsv_content, password)
        enc_dir = os.path.join(DASHBOARD_DATA_PATH, year)
        os.makedirs(enc_dir, exist_ok=True)
        
        enc_file = os.path.join(enc_dir, f"{year}{month.zfill(2)}.enc")
        with open(enc_file, 'w', encoding='utf-8') as f:
            f.write(enc_content)
            
        # 4. Executar publicar.ps1 para commitar e dar push
        # Como o servidor roda localmente no PowerShell, usamos subprocess
        subprocess.Popen(["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", PUBLICAR_SCRIPT], 
                         cwd=os.path.dirname(PUBLICAR_SCRIPT))
                         
        return jsonify({"success": True, "message": "Salvo e publicado com sucesso"})
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Iniciando Servidor Backend para o Dashboard Financeiro...")
    print("Aguardando conexões em http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
