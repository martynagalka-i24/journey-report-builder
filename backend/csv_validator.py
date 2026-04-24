import pandas as pd
from io import StringIO

FILE_SCHEMAS = {
    "entry_paths": {
        "label": "Entry Paths (Q1b)",
        "required_columns": ["page_type", "cohort", "unique_users", "pct_of_cohort"],
    },
    "exit_paths": {
        "label": "Exit Paths (Q2b)",
        "required_columns": ["page_type", "cohort", "unique_users", "pct_of_cohort"],
    },
    "internal_transitions": {
        "label": "Internal Transitions (Q3)",
        "required_columns": ["cohort", "from_page", "to_page", "unique_users", "total_transitions", "pct_of_cohort"],
    },
    "pre_entry": {
        "label": "Pre-Entry Categories (Q4b)",
        "required_columns": ["domain_category", "cohort", "unique_users", "pct_of_cohort"],
    },
    "post_exit": {
        "label": "Post-Exit Categories (Q5b)",
        "required_columns": ["domain_category", "cohort", "unique_users", "pct_of_cohort"],
    },
    "mid_journey": {
        "label": "Mid-Journey Categories (Q6b)",
        "required_columns": ["domain_category", "cohort", "unique_users", "total_visits", "pct_of_cohort"],
    },
    "full_transitions": {
        "label": "Full Transitions (Q7)",
        "required_columns": ["cohort", "from_node", "to_node", "unique_users", "total_transitions", "pct_of_cohort"],
    },
}


def validate_csv(file_type: str, content: bytes) -> dict:
    schema = FILE_SCHEMAS.get(file_type)
    if not schema:
        return {"valid": False, "error": f"Unknown file type: {file_type}"}

    try:
        text = content.decode("utf-8-sig")  # handle BOM
        df = pd.read_csv(StringIO(text))
    except Exception as e:
        return {"valid": False, "error": f"Could not parse CSV: {str(e)}"}

    if df.empty:
        return {"valid": False, "error": "File is empty"}

    missing = [c for c in schema["required_columns"] if c not in df.columns]
    if missing:
        return {
            "valid": False,
            "error": f"Missing columns: {', '.join(missing)}",
            "missing_columns": missing,
        }

    return {
        "valid": True,
        "row_count": len(df),
        "columns": list(df.columns),
    }


def parse_csv_to_records(content: bytes) -> list[dict]:
    text = content.decode("utf-8-sig")
    df = pd.read_csv(StringIO(text))
    return df.to_dict(orient="records")
