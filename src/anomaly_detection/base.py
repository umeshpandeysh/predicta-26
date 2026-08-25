from abc import ABC, abstractmethod
import pandas as pd
import numpy as np

class AnomalyDetector(ABC):
    """Common interface for all AIPS outlier detectors."""

    @abstractmethod
    def fit(self, X: pd.DataFrame, lot_ids: pd.Series):
        pass

    @abstractmethod
    def score(self, X: pd.DataFrame, lot_ids: pd.Series) -> np.ndarray:
        pass

    @abstractmethod
    def predict(
        self, X: pd.DataFrame, lot_ids: pd.Series, threshold: float
    ) -> np.ndarray:
        pass
