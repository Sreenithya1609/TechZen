"""
File validation utilities for document uploads.
Validates file existence, extension, size, and header signatures.
"""

import os
import io

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {'pdf', 'txt'}

def validate_uploaded_file(file_storage, max_size=MAX_FILE_SIZE, allowed_extensions=ALLOWED_EXTENSIONS):
    """
    Validates an incoming Werkzeug FileStorage object.
    
    Returns:
        (is_valid, error_message)
    """
    if file_storage is None or not hasattr(file_storage, 'filename'):
        return False, "No file uploaded. Please select a file to upload."

    filename = (file_storage.filename or '').strip()
    if not filename:
        return False, "Uploaded file must have a valid filename."

    # Extension check
    if '.' not in filename:
        return False, f"File has no extension. Allowed types are: {', '.join(sorted(allowed_extensions)).upper()}."

    ext = filename.rsplit('.', 1)[1].lower()
    if ext not in allowed_extensions:
        return False, f"Unsupported file format '.{ext}'. Allowed types are: {', '.join(sorted(allowed_extensions)).upper()}."

    # Size check
    try:
        file_storage.seek(0, os.SEEK_END)
        file_size = file_storage.tell()
        file_storage.seek(0)
    except Exception as exc:
        return False, f"Unable to read file stream: {exc}"

    if file_size == 0:
        return False, "Uploaded file is empty (0 bytes)."

    if file_size > max_size:
        max_mb = max_size // (1024 * 1024)
        return False, f"File size ({round(file_size / (1024 * 1024), 2)} MB) exceeds the maximum allowed limit of {max_mb} MB."

    # Deep signature validation
    if ext == 'pdf':
        header = file_storage.read(5)
        file_storage.seek(0)
        if header != b'%PDF-':
            return False, "Invalid PDF file content. File does not match PDF specification."
    elif ext == 'txt':
        sample = file_storage.read(512)
        file_storage.seek(0)
        if b'\x00' in sample:
            return False, "Invalid text file. File contains binary data."

    return True, None
