"""Shared Pydantic base model with camelCase aliasing.

All request/response models must inherit from CamelModel so that:
- JSON I/O uses camelCase field names (alias_generator=to_camel).
- Python internals use snake_case attribute names.
- Both snake_case and camelCase work on input (populate_by_name=True).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

