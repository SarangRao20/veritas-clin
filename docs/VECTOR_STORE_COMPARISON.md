# Vector Storage Backends — SQLite vs FAISS vs ChromaDB

Veritas-Clin uses **SQLite float32 BLOBs** by default for zero-infrastructure, offline clinical RAG.
This keeps the prototype simple, auditable, and reproducible in academic environments.

When dataset size grows, consider:

## 1. SQLite (current default)
- **Pros:** Zero dependencies, ACID transactions, audit-logging friendly, storage of embeddings + metadata in one file.
- **Cons:** Linear cosine scan — O(N) per query. Fine for <~100,000 passages.
- **Use when:** Building the academic workbench / on-prem prototypes.

## 2. FAISS (Meta)
- **Pros:** Blazing-fast ANN indices (IVF-Flat, HNSW) on CPU/GPU. Free, open-source, no server.
- **Cons:** No native metadata filtering (you join with SQLite by passage IDs); persistence requires explicit `write_index()`.
- **Use when:** 100k+ vector or sub-10 ms search critical.

```python
# Example future integration skeleton
from faiss import IndexFlatIP
import numpy as np

index = IndexFlatIP(384)              # all-MiniLM-L6-v2 dim
index.add(np.asarray(vectors))       # normalised vectors
scores, ids = index.search(query_vec, top_k)
```

## 3. ChromaDB
- **Pros:** Metadata filtering + document store + vector index in one Python package; auto-persistence; similar API to LanceDB.
- **Cons:** Significantly larger dependency footprint; **no official Python 3.14 wheel yet** (as of Oct 2026).
- **Use when:** Multi-tenant vector indexing with metadata-rich filtering and persistent server.

## Recommended Path (current project)
1. Keep **SQLite** for clinical document & passage metadata (HIPAA audit trails, user ownership).
2. Replace linear scan with **FAISS CPU** (`faiss-cpu`) if >=100k passages are added.
3. Use **ChromaDB** only if reproducible across multiple services with a dedicated vector microservice is required.
4. Heavy LLM + embedding speedup: use `scripts/colab_server.py` for **Google Colab GPU inference**.