"""veritas-clin: evidence-grounded clinical information extraction with calibrated abstention."""

from .config import SETTINGS
from .pipeline import ExtractionPipeline
from .schemas import Claim, Decision, ExtractRequest, ExtractionResponse, FindingType, VerifiedClaim

__version__ = "0.1.0"
__all__ = [
    "SETTINGS",
    "Claim",
    "Decision",
    "ExtractRequest",
    "ExtractionResponse",
    "ExtractionPipeline",
    "FindingType",
    "VerifiedClaim",
]
