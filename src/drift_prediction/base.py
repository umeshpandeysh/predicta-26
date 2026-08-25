from abc import ABC, abstractmethod
import pandas as pd
import numpy as np

class DriftPredictor(ABC):
    """Common interface for all AIPS parameter trend predictors."""
    @abstractmethod
    def fit(self, X: pd.DataFrame, y: pd.Series):
        pass
        
    @abstractmethod
    def predict(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        pass
