from abc import ABC, abstractmethod
import pandas as pd

class BaseParser(ABC):
    """Abstract base class for all dataset ingestion parsers."""

    @abstractmethod
    def load(self, file_path: str) -> pd.DataFrame:
        """Load raw data and return a standard pandas DataFrame."""
        pass

    @abstractmethod
    def map_to_canonical(self, df: pd.DataFrame) -> pd.DataFrame:
        """Map dataset columns to the canonical SEMICONDUCTOR_TELEMETRY schema."""
        pass
