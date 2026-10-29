#!/usr/bin/env bash
# ==============================================================================
# Veritas-Clin: Full-Stack Clinical Case Review & NLP Workbench Launcher
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${1:-prod}"
HOST="127.0.0.1"
PORT="8000"
FRONTEND_PORT="5173"

# Colors for terminal output
BOLD="\033[1m"
GREEN="\033[0;32m"
TEAL="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${TEAL}${BOLD}"
cat << "EOF"
 __     __        _ _                 ____ _ _       
 \ \   / /__ _ __(_) |_ __ _ ___     / ___| (_)_ __  
  \ \ / / _ \ '__| | __/ _` / __|___ | |   | | | '_ \ 
   \ V /  __/ |  | | || (_| \__ \___|| |___| | | | | |
    \_/ \___|_|  |_|\__\__,_|___/     \____|_|_|_| |_|
  Evidence-Grounded Clinical Intelligence Workbench
EOF
echo -e "${RESET}"

# ------------------------------------------------------------------------------
# 1. Environment & Python Virtualenv Checks
# ------------------------------------------------------------------------------
echo -e "${BOLD}[1/4] Checking Python environment...${RESET}"
if [ -d "$ROOT_DIR/.venv" ]; then
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.venv/bin/activate"
    PYTHON_CMD="$ROOT_DIR/.venv/bin/python"
    UVICORN_CMD="$ROOT_DIR/.venv/bin/uvicorn"
elif command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
    UVICORN_CMD="uvicorn"
else
    echo -e "${RED}Error: Python 3 is required but not found.${RESET}" >&2
    exit 1
fi

echo -e "      Python executable: ${GREEN}$($PYTHON_CMD --version)${RESET}"

# ------------------------------------------------------------------------------
# 2. Local LLM / Ollama & Embedding Status
# ------------------------------------------------------------------------------
echo -e "${BOLD}[2/4] Checking local models & inference engine...${RESET}"
if curl -s -m 2 http://127.0.0.1:11434/api/tags &>/dev/null; then
    echo -e "      ${GREEN}✓ Local Ollama instance detected at 127.0.0.1:11434${RESET}"
    MODELS=$(curl -s http://127.0.0.1:11434/api/tags | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | head -3 | tr '\n' ' ')
    if [ -n "$MODELS" ]; then
        echo -e "      Available local models: ${TEAL}${MODELS}${RESET}"
    fi
else
    echo -e "      ${YELLOW}ℹ Local Ollama not active on port 11434.${RESET}"
    echo -e "      Using local deterministic zero-hallucination evidence grounding."
fi

# ------------------------------------------------------------------------------
# 3. Database Initialization & Clinical Record Seeding
# ------------------------------------------------------------------------------
echo -e "${BOLD}[3/4] Initializing patient cases & embedding database...${RESET}"
$PYTHON_CMD -c '
from pathlib import Path
from veritas_clin.config import DATABASE_PATH, CLINICAL_RECORDS_DIR, DEMO_DOCUMENTS_DIR
from veritas_clin.models.database import init_schema
from veritas_clin.store.document_store import DocumentStore
from veritas_clin.store.patient_store import PatientStore
from veritas_clin.document_nlp import DocumentProcessor, LocalSentenceEmbedder, seed_clinical_records, seed_demo_documents

init_schema(DATABASE_PATH)
store = DocumentStore(DATABASE_PATH)
processor = DocumentProcessor(LocalSentenceEmbedder())

# Seed authentic institutional records
if CLINICAL_RECORDS_DIR.is_dir():
    seed_clinical_records(store, processor, CLINICAL_RECORDS_DIR)

pstore = PatientStore(DATABASE_PATH)
patients = pstore.list_patients(admin=True)
print(f"      {len(patients)} multi-encounter patient cases ready in database.")
for p in patients:
    pid = p["patient_id"]
    dc = p["document_count"]
    pc = p["passage_count"]
    f_at = p["first_event_at"]
    l_at = p["last_event_at"]
    print(f"      -> {pid}: {dc} records, {pc} grounded passages ({f_at} to {l_at})")
'

# ------------------------------------------------------------------------------
# 4. Frontend & Server Execution
# ------------------------------------------------------------------------------
cleanup() {
    echo -e "\n${YELLOW}Shutting down Veritas-Clin services...${RESET}"
    if [ -n "${VITE_PID:-}" ] && kill -0 "$VITE_PID" 2>/dev/null; then
        kill "$VITE_PID" 2>/dev/null || true
    fi
    if [ -n "${UVICORN_PID:-}" ] && kill -0 "$UVICORN_PID" 2>/dev/null; then
        kill "$UVICORN_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo -e "${BOLD}[4/4] Starting interface and API server...${RESET}"

# Check if port is already occupied by a listening process
if lsof -ti tcp:"$PORT" -sTCP:LISTEN &>/dev/null; then
    LISTEN_PID=$(lsof -ti tcp:"$PORT" -sTCP:LISTEN | head -1)
    echo -e "      ${YELLOW}Notice: Port $PORT is occupied by listening process (PID $LISTEN_PID).${RESET}"
    echo -e "      Terminating existing process to bind fresh server instance..."
    kill -9 "$LISTEN_PID" 2>/dev/null || true
    sleep 1
fi

if [[ "$MODE" == "--dev" || "$MODE" == "dev" ]]; then
    # Development Mode: Run Vite dev server and Uvicorn concurrently
    echo -e "      Mode: ${YELLOW}Development (Hot Module Replacement + API Reload)${RESET}"
    
    cd "$ROOT_DIR/frontend"
    npm run dev -- --host "$HOST" --port "$FRONTEND_PORT" &
    VITE_PID=$!
    cd "$ROOT_DIR"

    $UVICORN_CMD veritas_clin.serve:app --reload --host "$HOST" --port "$PORT" &
    UVICORN_PID=$!

    echo -e "\n${GREEN}${BOLD}✓ Veritas-Clin is running!${RESET}"
    echo -e "  • Frontend Web Application : ${TEAL}${BOLD}http://$HOST:$FRONTEND_PORT/patients${RESET}"
    echo -e "  • Backend API & Health     : ${TEAL}http://$HOST:$PORT/health${RESET}"
    echo -e "  • Interactive API Docs     : ${TEAL}http://$HOST:$PORT/api/docs${RESET}\n"
    echo -e "Press ${BOLD}Ctrl+C${RESET} to stop all services.\n"
    
    wait "$UVICORN_PID" "$VITE_PID"

else
    # Production / Unified Mode: Build frontend and serve unified on port 8000
    if [ ! -d "$ROOT_DIR/frontend/dist" ] || [ ! -f "$ROOT_DIR/frontend/dist/index.html" ]; then
        echo -e "      Building frontend distribution assets..."
        (cd "$ROOT_DIR/frontend" && npm run build)
    fi

    echo -e "\n${GREEN}${BOLD}✓ Veritas-Clin is live and ready!${RESET}"
    echo -e "  • Clinical Patient Registry : ${TEAL}${BOLD}http://$HOST:$PORT/patients${RESET}"
    echo -e "  • Interactive Case Review   : ${TEAL}${BOLD}http://$HOST:$PORT/cases/PT-4091${RESET}"
    echo -e "  • Search & Extraction API   : ${TEAL}http://$HOST:$PORT/api/docs${RESET}\n"
    echo -e "Press ${BOLD}Ctrl+C${RESET} to stop server.\n"

    exec $UVICORN_CMD veritas_clin.serve:app --host "$HOST" --port "$PORT"
fi
