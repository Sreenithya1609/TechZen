"""
RAG (Retrieval-Augmented Generation) Service for FlashLearn.
Provides:
1. Local deterministic vector embedding generation & Gemini text-embedding-004 integration
2. Cosine similarity semantic search
3. Page-aware PDF document parsing, text chunking, and database indexing
4. Top-K semantic retrieval
5. Grounded flashcard synthesis with exact source citations (page & quote)
6. Grounded document Q&A ("Ask Document")
"""

import os
import io
import re
import json
import math
import uuid
import hashlib
from urllib import error as urllib_error
from urllib import request as urllib_request
from pypdf import PdfReader
from database.connection import get_db_connection
from services.document_service import clean_text

DEFAULT_VECTOR_DIM = 128

def generate_local_embedding(text, dim=DEFAULT_VECTOR_DIM):
    """
    Generates a deterministic normalized unit vector using sub-word n-grams and word hashing.
    Runs 100% offline with zero external dependencies.
    """
    if not text or not text.strip():
        # Return zero vector or uniform vector
        val = 1.0 / math.sqrt(dim)
        return [val] * dim

    clean = clean_text(text).lower()
    vec = [0.0] * dim

    # 1. Word tokens
    words = re.findall(r'\b[a-z0-9_]{2,}\b', clean)
    for w in words:
        h = int(hashlib.md5(w.encode('utf-8')).hexdigest(), 16)
        idx = h % dim
        sign = 1.0 if ((h >> 8) % 2 == 0) else -1.0
        # Weight by word length
        vec[idx] += sign * min(3.0, 1.0 + (len(w) * 0.15))

    # 2. Character 3-grams for morphological and substring similarity
    for i in range(len(clean) - 2):
        ngram = clean[i:i+3]
        h = int(hashlib.md5(ngram.encode('utf-8')).hexdigest(), 16)
        idx = h % dim
        sign = 1.0 if ((h >> 8) % 2 == 0) else -1.0
        vec[idx] += sign * 0.35

    # 3. L2 Unit Normalization
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 1e-9:
        return [round(x / norm, 6) for x in vec]
    else:
        val = 1.0 / math.sqrt(dim)
        return [round(val, 6)] * dim


def generate_embedding(text):
    """
    Two-tier embedding generator:
    Attempts Google Gemini embedding (gemini-embedding-2 / gemini-embedding-001) if API key is active.
    Falls back gracefully to local deterministic unit vector embedding.
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    if api_key and api_key != 'test-gemini-key' and not api_key.startswith('test-'):
        for embed_model in ['gemini-embedding-2', 'gemini-embedding-001']:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{embed_model}:embedContent?key={api_key}"
                payload = json.dumps({
                    "model": f"models/{embed_model}",
                    "content": {"parts": [{"text": text[:2000]}]}
                }).encode('utf-8')
                req = urllib_request.Request(
                    url,
                    data=payload,
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                with urllib_request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    values = data.get('embedding', {}).get('values')
                    if values and isinstance(values, list):
                        # L2 Normalize Gemini embedding
                        norm = math.sqrt(sum(x * x for x in values))
                        if norm > 1e-9:
                            return [round(x / norm, 6) for x in values]
            except Exception:
                continue

    return generate_local_embedding(text)


def compute_cosine_similarity(vec_a, vec_b):
    """
    Computes cosine similarity between two vectors.
    Since vectors are unit normalized, similarity is the dot product.
    """
    if not vec_a or not vec_b:
        return 0.0

    dim = min(len(vec_a), len(vec_b))
    dot = sum(vec_a[i] * vec_b[i] for i in range(dim))
    # Clamp to [-1.0, 1.0]
    return max(-1.0, min(1.0, float(dot)))


def chunk_page_text(page_text, page_number, target_words=140, overlap=25):
    """
    Splits text from a single page into overlapping semantic chunks with page metadata.
    """
    words = page_text.split()
    if not words:
        return []

    if len(words) <= target_words:
        return [{
            'page_number': page_number,
            'content': " ".join(words),
            'word_count': len(words)
        }]

    chunks = []
    step = max(1, target_words - overlap)
    for i in range(0, len(words), step):
        chunk_words = words[i:i + target_words]
        if chunk_words:
            chunks.append({
                'page_number': page_number,
                'content': " ".join(chunk_words),
                'word_count': len(chunk_words)
            })
        if i + target_words >= len(words):
            break

    return chunks


def index_pdf_document(file_storage, filename, user_id, classroom_id=None):
    """
    Parses an uploaded PDF file, extracts text per page, breaks it into semantic chunks,
    generates vector embeddings, and stores everything in SQLite.

    Returns:
        (doc_info_dict, None) or (None, error_str)
    """
    try:
        file_storage.seek(0)
        file_bytes = io.BytesIO(file_storage.read())
        file_size = file_bytes.getbuffer().nbytes

        reader = PdfReader(file_bytes)
        total_pages = len(reader.pages)
        if total_pages == 0:
            return None, "PDF file contains no pages."

        all_chunks = []
        total_extracted_chars = 0

        for idx, page in enumerate(reader.pages):
            page_num = idx + 1
            raw_text = page.extract_text() or ''
            cleaned = clean_text(raw_text)
            if cleaned:
                total_extracted_chars += len(cleaned)
                page_chunks = chunk_page_text(cleaned, page_number=page_num)
                all_chunks.extend(page_chunks)

        if total_extracted_chars < 10 or not all_chunks:
            return None, "PDF contains no readable text (it may be scanned or empty)."

        # Derive human-friendly title
        raw_name = filename.rsplit('.', 1)[0]
        doc_title = raw_name.replace('_', ' ').replace('-', ' ').strip().title() or "Course Document"

        doc_id = f"doc-{uuid.uuid4().hex[:12]}"

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO course_documents (id, user_id, classroom_id, filename, title, file_size, total_pages, total_chunks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (doc_id, user_id, classroom_id, filename, doc_title, file_size, total_pages, len(all_chunks)))

        chunk_rows = []
        for c_idx, ch in enumerate(all_chunks):
            chunk_id = f"chk-{uuid.uuid4().hex[:12]}"
            emb = generate_embedding(ch['content'])
            metadata = {
                'page_number': ch['page_number'],
                'word_count': ch['word_count'],
                'filename': filename
            }
            chunk_rows.append((
                chunk_id,
                doc_id,
                c_idx,
                ch['page_number'],
                ch['content'],
                json.dumps(emb),
                json.dumps(metadata)
            ))

        cursor.executemany("""
            INSERT INTO document_chunks (id, document_id, chunk_index, page_number, content, embedding_json, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, chunk_rows)

        conn.commit()
        conn.close()

        return {
            'document_id': doc_id,
            'title': doc_title,
            'filename': filename,
            'file_size': file_size,
            'total_pages': total_pages,
            'total_chunks': len(all_chunks),
            'extracted_chars': total_extracted_chars
        }, None

    except Exception as exc:
        return None, f"Failed to index PDF document: {str(exc)}"


def retrieve_relevant_chunks(document_id, query_text, top_k=3):
    """
    Performs cosine similarity search against indexed document chunks.
    Returns ranked list of top_k chunks with similarity scores.
    """
    if not query_text or not query_text.strip():
        return []

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, chunk_index, page_number, content, embedding_json, metadata_json
        FROM document_chunks
        WHERE document_id = ?
        ORDER BY chunk_index ASC
    """, (document_id,))
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return []

    query_vec = generate_embedding(query_text)
    scored = []

    for r in rows:
        try:
            c_vec = json.loads(r['embedding_json'])
            sim = compute_cosine_similarity(query_vec, c_vec)
        except Exception:
            sim = 0.0

        metadata = {}
        if r['metadata_json']:
            try:
                metadata = json.loads(r['metadata_json'])
            except Exception:
                pass

        scored.append({
            'id': r['id'],
            'chunk_index': r['chunk_index'],
            'page_number': r['page_number'],
            'content': r['content'],
            'metadata': metadata,
            'score': round(float(sim), 4)
        })

    # Sort descending by similarity score
    scored.sort(key=lambda x: x['score'], reverse=True)
    return scored[:top_k]


def extract_rag_flashcards(document_id, count=6, level='Intermediate Mastery'):
    """
    RAG Flashcard Synthesizer:
    Retrieves high-salience chunks across pages and synthesizes flashcards
    grounded with verifiable page citations and quoted snippets.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, chunk_index, page_number, content
        FROM document_chunks
        WHERE document_id = ?
        ORDER BY chunk_index ASC
    """, (document_id,))
    chunks = cursor.fetchall()

    cursor.execute("SELECT title, filename, total_pages FROM course_documents WHERE id = ?", (document_id,))
    doc_meta = cursor.fetchone()
    conn.close()

    if not chunks:
        return []

    # Distribute chunk sampling across pages
    total_chunks = len(chunks)
    step = max(1, total_chunks // min(count * 2, total_chunks))
    sampled_chunks = [chunks[i] for i in range(0, total_chunks, step)][:min(count * 3, total_chunks)]

    # Attempt Gemini extraction if available
    api_key = os.environ.get('GEMINI_API_KEY')
    if api_key and api_key != 'test-gemini-key' and not api_key.startswith('test-'):
        gemini_cards = _extract_flashcards_gemini(sampled_chunks, count, level, doc_meta['title'] if doc_meta else 'Course Material')
        if gemini_cards:
            return gemini_cards

    # Resilient offline extractor
    return _extract_flashcards_offline(chunks, count=count, level=level)


def _extract_flashcards_gemini(sampled_chunks, count, level, title):
    """Invokes Gemini with retrieved page chunks to produce cited flashcards."""
    context_blocks = []
    for c in sampled_chunks:
        context_blocks.append(f"[PAGE {c['page_number']}]\n{c['content']}")

    context_str = "\n\n---\n\n".join(context_blocks)

    prompt = f"""You are an elite academic curriculum designer and flashcard generator.
Based EXCLUSIVELY on the provided document passages below, generate exactly {count} high-yield study flashcards.
Target Rigor Level: {level}.

Context Passages:
{context_str}

Guidelines:
1. Each flashcard MUST be grounded strictly in the provided text passages.
2. For each flashcard, cite the exact source page number from [PAGE X].
3. Include a short direct citation quote (5 to 15 words) from that page.
4. Difficulty must be one of: "easy", "medium", "hard".

Respond ONLY with a JSON array in this exact schema:
[
  {{
    "question": "Clear, direct question",
    "answer": "Accurate, concise factual answer",
    "difficulty": "medium",
    "page_number": 1,
    "citation_quote": "Exact quoted sentence or phrase from that page",
    "source_citation": "Page 1: \\"...exact snippet...\\""
  }}
]"""

    try:
        from services.ai_service import call_gemini_api
        text, err = call_gemini_api(prompt, response_mime_type="application/json", timeout=30)
        if not err and text:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                parsed = (
                    parsed.get('cards') or
                    parsed.get('flashcards') or
                    parsed.get('questions') or
                    next((v for v in parsed.values() if isinstance(v, list)), [])
                )
            if isinstance(parsed, list) and len(parsed) > 0:
                cards = []
                for c in parsed:
                    if isinstance(c, dict) and c.get('question') and c.get('answer'):
                        if 'source_citation' not in c or not c['source_citation']:
                            p = c.get('page_number', 1)
                            c['source_citation'] = f"Page {p}: \"{c.get('citation_quote', '')[:100]}\""
                        cards.append(c)
                if cards:
                    return cards
    except Exception:
        pass
    return None



def _extract_flashcards_offline(chunks, count=6, level='Intermediate Mastery'):
    """
    Deterministic rule-based academic fact extractor.
    Extracts definitions, principles, and key facts while attributing exact page numbers.
    """
    cards = []
    seen_questions = set()

    definition_patterns = [
        r'([^.\n]+?)\s+(?:is defined as|refers to|is a process of|is a|are)\s+([^.\n]+?\.)',
        r'([^.\n]+?)\s+(?:functions to|is responsible for|allows)\s+([^.\n]+?\.)',
        r'([^.\n]+?)\s*:\s*([^.\n]{20,180}\.)'
    ]

    for ch in chunks:
        page_num = ch['page_number']
        text = ch['content']
        sentences = re.split(r'(?<=[.!?])\s+', text)

        for s in sentences:
            s_clean = s.strip()
            if len(s_clean) < 30 or len(s_clean) > 280:
                continue

            for pat in definition_patterns:
                match = re.search(pat, s_clean, re.IGNORECASE)
                if match:
                    term = match.group(1).strip()
                    explanation = match.group(2).strip()

                    # Clean up term
                    term = re.sub(r'^(furthermore|additionally|moreover|however|in summary|for example),?\s*', '', term, flags=re.IGNORECASE)
                    if len(term.split()) > 8 or len(term) < 3:
                        continue

                    q = f"What is {term}?"
                    if q.lower() in seen_questions:
                        continue

                    seen_questions.add(q.lower())
                    cards.append({
                        'question': q,
                        'answer': explanation.capitalize(),
                        'difficulty': 'medium' if len(cards) % 2 == 0 else 'easy',
                        'page_number': page_num,
                        'citation_quote': s_clean[:80] + ('...' if len(s_clean) > 80 else ''),
                        'source_citation': f'Page {page_num}: "{s_clean[:60]}..."'
                    })
                    break

            if len(cards) >= count:
                break
        if len(cards) >= count:
            break

    # If pattern matching didn't yield enough, extract sentences directly
    if len(cards) < count:
        for ch in chunks:
            page_num = ch['page_number']
            sentences = [s.strip() for s in ch['content'].split('.') if len(s.strip()) > 35]
            for s in sentences:
                q = f"What key principle is described on Page {page_num}?"
                if s.lower() in seen_questions:
                    continue
                seen_questions.add(s.lower())
                cards.append({
                    'question': f"Explain: {s[:50]}...",
                    'answer': s + '.',
                    'difficulty': 'medium',
                    'page_number': page_num,
                    'citation_quote': s[:70] + '...',
                    'source_citation': f'Page {page_num}: "{s[:50]}..."'
                })
                if len(cards) >= count:
                    break
            if len(cards) >= count:
                break

    return cards[:count]


def answer_document_query(document_id, query_text):
    """
    RAG Grounded Q&A ("Ask Document"):
    Retrieves the most semantically relevant chunks for a user question
    and synthesizes a grounded answer with page citations.
    """
    top_chunks = retrieve_relevant_chunks(document_id, query_text, top_k=3)
    if not top_chunks:
        return {
            'answer': "No relevant content found in the document for your query.",
            'citations': [],
            'query': query_text
        }

    # Context assembly
    context_passages = []
    citations = []
    for c in top_chunks:
        context_passages.append(f"[PAGE {c['page_number']}] (Score: {c['score']})\n{c['content']}")
        citations.append({
            'page_number': c['page_number'],
            'score': c['score'],
            'snippet': c['content'][:160] + ('...' if len(c['content']) > 160 else '')
        })

    api_key = os.environ.get('GEMINI_API_KEY')
    if api_key and api_key != 'test-gemini-key' and not api_key.startswith('test-'):
        context_str = "\n\n".join(context_passages)
        prompt = f"""You are a precise academic teaching assistant answering a student's question about an uploaded course document.
Answer the question using ONLY the provided excerpts below.
Cite the relevant page numbers in your answer (e.g., "According to Page 2...").
If the excerpts do not contain sufficient information, state that clearly without guessing.

Excerpts:
{context_str}

Question:
{query_text}"""

        try:
            from services.ai_service import call_gemini_api
            answer_text, err = call_gemini_api(prompt, response_mime_type="text/plain", timeout=20)
            if not err and answer_text:
                return {
                    'answer': answer_text.strip(),
                    'citations': citations,
                    'query': query_text
                }
        except Exception:
            pass


    # Offline Grounded Synthesis
    best_chunk = top_chunks[0]
    best_text = best_chunk['content']
    sentences = [s.strip() for s in best_text.split('.') if len(s.strip()) > 15]
    summary_sentence = sentences[0] if sentences else best_text[:120]

    offline_answer = f"According to Page {best_chunk['page_number']}, {summary_sentence}. (Source: Page {best_chunk['page_number']})"
    return {
        'answer': offline_answer,
        'citations': citations,
        'query': query_text
    }
