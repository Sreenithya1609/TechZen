"""
Document processing and text extraction service.
Supports PDF parsing via pypdf and TXT text decoding, cleaning, and semantic chunking.
"""

import io
import re
from pypdf import PdfReader

def extract_text_from_file(file_storage, filename):
    """
    Extracts text from an uploaded file storage object.
    
    Returns:
        (extracted_text, error_message)
    """
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    
    try:
        if ext == 'pdf':
            file_storage.seek(0)
            file_bytes = io.BytesIO(file_storage.read())
            reader = PdfReader(file_bytes)
            
            if len(reader.pages) == 0:
                return None, "PDF file contains no pages."

            text_parts = []
            for idx, page in enumerate(reader.pages):
                page_text = page.extract_text() or ''
                if page_text.strip():
                    text_parts.append(page_text.strip())

            extracted = "\n\n".join(text_parts).strip()
            if len(extracted) < 10:
                return None, "PDF contains no readable text (it may contain only scanned images or be empty)."

            return clean_text(extracted), None

        elif ext == 'txt':
            file_storage.seek(0)
            raw_data = file_storage.read()
            try:
                text = raw_data.decode('utf-8')
            except UnicodeDecodeError:
                text = raw_data.decode('latin-1', errors='replace')

            cleaned = text.strip()
            if len(cleaned) < 10:
                return None, "Text file is empty or contains insufficient readable characters."

            return clean_text(cleaned), None

        else:
            return None, f"Unsupported file extension '.{ext}'."

    except Exception as exc:
        return None, f"Failed to extract text from document: {str(exc)}"


def clean_text(text):
    """Normalizes whitespace and line breaks."""
    # Replace carriage returns
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    # Collapse 3+ newlines to 2
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Collapse multiple inline spaces
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip()


def chunk_text(text, max_words=1200, overlap=120):
    """
    Splits long academic text into manageable chunks with overlap for LLM processing.
    """
    words = text.split()
    if len(words) <= max_words:
        return [text]

    chunks = []
    step = max(1, max_words - overlap)
    for i in range(0, len(words), step):
        chunk_words = words[i:i + max_words]
        if chunk_words:
            chunks.append(" ".join(chunk_words))
        if i + max_words >= len(words):
            break
            
    return chunks
