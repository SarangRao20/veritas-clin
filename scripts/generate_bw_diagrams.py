#!/usr/bin/env python3
"""
Generate publication-grade, minimalist Black & White (monochrome) academic diagrams
for IEEE / ACM / PICT engineering lab reports.
Pure black and white, zero colors, crisp borders, generous whitespace, zero text collisions.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Polygon, Rectangle
import os

os.environ['MPLCONFIGDIR'] = '/tmp/matplotlib_conf'

plt.rcParams['font.family'] = 'serif'
plt.rcParams['mathtext.fontset'] = 'cm'
plt.rcParams['font.size'] = 9.5
plt.rcParams['axes.edgecolor'] = 'black'
plt.rcParams['axes.linewidth'] = 1.0


def draw_box(ax, x, y, w, h, title, subtitle=None, details=None, style='solid', lw=1.2, fill='white'):
    """Draw a clean monochrome academic box with sharp corners and centered typography."""
    bbox = FancyBboxPatch((x, y), w, h,
                          boxstyle="square,pad=0",
                          ec="black", fc=fill,
                          linestyle=style, linewidth=lw)
    ax.add_patch(bbox)
    
    if subtitle and details:
        ty_title = y + h - 0.22 * h
        ty_sub = y + h - 0.48 * h
        ty_det = y + 0.20 * h
        ax.text(x + w / 2, ty_title, title, ha='center', va='center', fontsize=9.5, fontweight='bold', color='black')
        ax.text(x + w / 2, ty_sub, subtitle, ha='center', va='center', fontsize=8.0, style='italic', color='#222222')
        ax.text(x + w / 2, ty_det, details, ha='center', va='center', fontsize=7.2, color='#333333')
    elif subtitle:
        ty_title = y + h - 0.35 * h
        ty_sub = y + 0.32 * h
        ax.text(x + w / 2, ty_title, title, ha='center', va='center', fontsize=9.5, fontweight='bold', color='black')
        ax.text(x + w / 2, ty_sub, subtitle, ha='center', va='center', fontsize=8.0, color='#333333')
    else:
        ax.text(x + w / 2, y + h / 2, title, ha='center', va='center', fontsize=9.5, fontweight='bold', color='black')


def draw_arrow(ax, x1, y1, x2, y2, label=None, label_offset=(0, 0), style='-', lw=1.1):
    """Draw a crisp black arrow between components with clear background for label."""
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="-|>", color="black", lw=lw, linestyle=style,
                                mutation_scale=11, shrinkA=0, shrinkB=0))
    if label:
        lx = (x1 + x2) / 2 + label_offset[0]
        ly = (y1 + y2) / 2 + label_offset[1]
        ax.text(lx, ly, label, ha='center', va='center', fontsize=7.5,
                backgroundcolor='white',
                bbox=dict(boxstyle='square,pad=0.2', fc='white', ec='none'))


def generate_architecture_block_diagram():
    """
    Minimalist Black & White System Architecture Block Diagram
    """
    fig, ax = plt.subplots(figsize=(12.2, 4.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 42)
    ax.axis('off')

    # Subsystem 1: Ingestion & Privacy
    rect_sub1 = Rectangle((1.5, 1.5), 24.5, 36.5, fill=False, edgecolor='#777777', linestyle='--', linewidth=0.8)
    ax.add_patch(rect_sub1)
    ax.text(13.75, 36.2, "STAGE 1: INGESTION & DE-ID", ha='center', fontsize=8.5, fontweight='bold', color='#333333')

    draw_box(ax, 3.5, 21.5, 20.5, 12.5, "EHR Inpatient Records", "Multi-Encounter PDFs / Notes", "H&P, Cath Labs, Flowsheets")
    draw_box(ax, 3.5, 4.0, 20.5, 12.5, "Safe Harbor De-ID", "Regex Sanitizer", "18 HIPAA Classes Scrubbed")
    draw_arrow(ax, 13.75, 21.5, 13.75, 16.5, "Raw Text")

    # Arrow from Stage 1 to Stage 2
    draw_arrow(ax, 24, 10.25, 29.5, 10.25, "Sanitized Text")

    # Subsystem 2: Dual-Stream Indexing & Storage
    rect_sub2 = Rectangle((28, 1.5), 43, 36.5, fill=False, edgecolor='#777777', linestyle='--', linewidth=0.8)
    ax.add_patch(rect_sub2)
    ax.text(49.5, 36.2, "STAGE 2: DUAL-STREAM INDEXING & CACHING", ha='center', fontsize=8.5, fontweight='bold', color='#333333')

    draw_box(ax, 29.5, 22.0, 18.5, 12.0, "Dense Stream (S-BERT)", "all-MiniLM-L6-v2", "384-Dim Semantic Vectors")
    draw_box(ax, 29.5, 4.5, 18.5, 12.0, "Sparse Lexical (BM25+)", "Rank-BM25Plus Engine", "Exact Keyword Indexing (δ=1.0)")

    # Splitting arrow
    ax.plot([26.8, 26.8], [10.25, 28.0], color='black', lw=1.1)
    draw_arrow(ax, 26.8, 28.0, 29.5, 28.0)

    # SQLite Persistent Store
    draw_box(ax, 51.5, 8.5, 18, 21.0, "SQLite Store & Cache", "veritas_clin.db", "embedding_cache (Blob)\npassages & documents")

    # Connecting streams to SQLite Store
    draw_arrow(ax, 48.0, 28.0, 51.5, 23.5, "Dense Vectors", label_offset=(-0.5, 1.2))
    draw_arrow(ax, 48.0, 10.5, 51.5, 15.5, "Inverted Index", label_offset=(-0.5, -1.2))

    # Subsystem 3: Synthesis & Guardrails
    rect_sub3 = Rectangle((73, 1.5), 25.5, 36.5, fill=False, edgecolor='#777777', linestyle='--', linewidth=0.8)
    ax.add_patch(rect_sub3)
    ax.text(85.75, 36.2, "STAGE 3: GUARDRAILS & CDS", ha='center', fontsize=8.5, fontweight='bold', color='#333333')

    draw_box(ax, 74.5, 21.5, 22.5, 12.5, "RRF Fusion & Gate", "Reciprocal Rank Fusion", "RRF >= 0.015 Cutoff Gate\nTemporal Recency Boost")
    draw_box(ax, 74.5, 4.0, 22.5, 12.5, "Physician Station (CDS)", "React 19 + Watchdog", "Telemetry SVGs & Citations\nKDIGO-2 Contrast AKI Guard")

    # Arrow from SQLite to RRF: clean orthogonal path
    ax.plot([69.5, 72.0, 72.0], [24.0, 24.0, 27.5], color='black', lw=1.1)
    draw_arrow(ax, 72.0, 27.5, 74.5, 27.5, "Top-K Candidates", label_offset=(-1.2, 1.4))

    # Arrow from RRF to Station
    draw_arrow(ax, 85.75, 21.5, 85.75, 16.5, "Entailed Claims")

    plt.tight_layout()
    plt.savefig('docs/writeup/block_diagram.png', dpi=300, bbox_inches='tight', facecolor='white')
    plt.savefig('docs/writeup/block_diagram_bw.png', dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()
    print("Generated block_diagram.png and block_diagram_bw.png")


def draw_diamond(ax, cx, cy, rx, ry, text, subtext=None, lw=1.2):
    """Draw a clean monochrome academic decision diamond."""
    diamond = Polygon([(cx, cy + ry), (cx + rx, cy), (cx, cy - ry), (cx - rx, cy)],
                      closed=True, ec="black", fc="white", lw=lw)
    ax.add_patch(diamond)
    if subtext:
        ax.text(cx, cy + 0.28 * ry, text, ha='center', va='center', fontsize=8.5, fontweight='bold')
        ax.text(cx, cy - 0.35 * ry, subtext, ha='center', va='center', fontsize=7.2, style='italic')
    else:
        ax.text(cx, cy, text, ha='center', va='center', fontsize=8.5, fontweight='bold')


def generate_flow_diagram():
    """
    Minimalist Black & White Algorithmic Flowchart
    """
    fig, ax = plt.subplots(figsize=(10.8, 5.4), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 54)
    ax.axis('off')

    # 1. Query Ingestion
    draw_box(ax, 37, 45, 26, 7.0, "1. Query Ingestion", "Input: (Query Q, Patient ID Pid)", fill='white')

    # Arrow to 2
    draw_arrow(ax, 50, 45, 50, 40.5)

    # 2. Dual Feature Encoding
    draw_box(ax, 27, 33.5, 46, 7.0, "2. Dual Feature Encoding", "Compute Dense Vector q (MiniLM) & Tokenize BM25 Terms", fill='white')

    # Arrow to 3
    draw_arrow(ax, 50, 33.5, 50, 29.0)

    # 3. Candidate Lookup & Scoring
    draw_box(ax, 27, 22.0, 46, 7.0, "3. Candidate Lookup & RRF Scoring", "Cosine Sim from SQLite cache + BM25 scores + Temporal Boost", fill='white')

    # Arrow to 4 (Diamond)
    draw_arrow(ax, 50, 22.0, 50, 17.5)

    # 4. Decision Diamond
    draw_diamond(ax, 50, 13.5, 16.5, 4.0, "max(RRF) >= 0.015?", "Relevance Threshold")

    # Branch A: Left -> Abstain
    draw_arrow(ax, 33.5, 13.5, 18.5, 13.5, "No (< 0.015)", label_offset=(0, 1.4))
    draw_box(ax, 1.5, 10.5, 17.0, 6.0, "Strict Abstention", "STATUS: NO_EVIDENCE\n(Zero Hallucination)", fill='#F8F8F8')

    draw_arrow(ax, 10.0, 10.5, 10.0, 5.5, label='Abstain Note', label_offset=(4.5, 0))
    draw_box(ax, 1.5, 1.5, 18.0, 4.0, "Final Clinical Note", fill='white')

    # Branch B: Right -> Entailment
    draw_arrow(ax, 66.5, 13.5, 76.5, 13.5, "Yes (>= 0.015)", label_offset=(0, 1.4))
    draw_box(ax, 76.5, 10.5, 22.0, 6.0, "5. Top-8 Claim Entailment", "Cosine Threshold >= 0.72\nExcise Ungrounded Sentences", fill='white')

    # Step 6: CDSS Watchdog & UI
    draw_arrow(ax, 87.5, 10.5, 87.5, 6.5)
    draw_box(ax, 72.0, 1.5, 26.5, 5.0, "6. CDSS Watchdog & UI", "KDIGO AKI Alert & Citations", fill='white')

    # Dashed arrow from CDSS to physician response
    ax.plot([72.0, 26.0], [3.5, 3.5], color='black', lw=1.0, linestyle='--')
    draw_arrow(ax, 26.0, 3.5, 19.5, 3.5, "Deliver Verified Note & Safety Alerts", label_offset=(20, 1.4), style='--')

    plt.tight_layout()
    plt.savefig('docs/writeup/flow_diagram.png', dpi=300, bbox_inches='tight', facecolor='white')
    plt.savefig('docs/writeup/flow_diagram_bw.png', dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()
    print("Generated flow_diagram.png and flow_diagram_bw.png")


if __name__ == '__main__':
    generate_architecture_block_diagram()
    generate_flow_diagram()
