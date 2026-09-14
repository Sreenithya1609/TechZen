"""
Input validation utilities for FlashLearn API endpoints.
"""

def validate_string(data, field_name, min_length=1, max_length=5000, required=True):
    """
    Validates a string field within a JSON payload dictionary.
    
    Returns:
        (cleaned_string, error_message)
        If valid: (cleaned_string, None)
        If invalid: (None, error_message)
    """
    if not isinstance(data, dict):
        return None, "Request payload must be a JSON object."

    if field_name not in data:
        if required:
            return None, f"Field '{field_name}' is required."
        return "", None

    val = data[field_name]
    if not isinstance(val, str):
        return None, f"Field '{field_name}' must be a string."

    cleaned = val.strip()
    if required and len(cleaned) < min_length:
        return None, f"Field '{field_name}' must contain at least {min_length} character(s)."

    if len(cleaned) > max_length:
        return None, f"Field '{field_name}' cannot exceed {max_length} characters."

    return cleaned, None

def validate_flashcard_id(data, required=False):
    """
    Validates a flashcard_id field from data.
    """
    if not isinstance(data, dict):
        return None, "Request payload must be a JSON object."
        
    card_id = data.get('flashcard_id')
    if card_id is None:
        if required:
            return None, "Field 'flashcard_id' is required."
        return None, None
        
    if not isinstance(card_id, (str, int)):
        return None, "Field 'flashcard_id' must be a string or integer."
        
    cleaned = str(card_id).strip()
    if not cleaned:
        if required:
            return None, "Field 'flashcard_id' cannot be empty."
        return None, None
        
    return cleaned, None
