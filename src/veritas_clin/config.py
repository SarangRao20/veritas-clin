"""Central configuration. Model ids and paths live here so nothing else hard-codes them."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    # Models
    extract_model: str = "Qwen/Qwen2.5-3B-Instruct"
    nli_model: str = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"

    # Max tokens the extractor may generate per note.
    max_new_tokens: int = 512

    # Decision score = w_nli * p_entail + w_tok * token_conf.
    w_nli: float = 0.8
    w_tok: float = 0.2
    token_conf_default: float = 0.5  # used when extractor cannot supply token confidence

    # flag_for_review band: score in [low_frac*tau, tau)
    low_frac: float = 0.8

    # Corpus
    n_notes: int = 40
    seed: int = 7
    dev_frac: float = 0.5

    # Paths
    root: Path = Path(__file__).resolve().parents[2]
    data_dir: Path = root / "data"
    artifacts_dir: Path = root / "artifacts"
    plots_dir: Path = artifacts_dir / "plots"

    @property
    def corpus_path(self) -> Path:
        return self.data_dir / "corpus.jsonl"

    @property
    def policy_path(self) -> Path:
        return self.artifacts_dir / "policy.json"

    @property
    def metrics_path(self) -> Path:
        return self.artifacts_dir / "metrics.json"

    @property
    def device(self) -> str:
        """torch device name; 'auto' resolves to cuda when available, at HF load time."""
        return os.getenv("VERITAS_DEVICE", "auto")


SETTINGS = Settings()


def ensure_dirs() -> None:
    for d in (SETTINGS.data_dir, SETTINGS.artifacts_dir, SETTINGS.plots_dir):
        d.mkdir(parents=True, exist_ok=True)
