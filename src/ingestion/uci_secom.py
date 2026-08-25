import pandas as pd
from .base import BaseParser

class UciSecomParser(BaseParser):
    def load(self, file_path: str) -> pd.DataFrame:
        return pd.read_csv(file_path, sep=' ', header=None)
        
    def map_to_canonical(self, df: pd.DataFrame) -> pd.DataFrame:
        mapped = pd.DataFrame()
        mapped['component_id'] = df.index.map(lambda i: f"COMP-UCI-{i:06d}")
        mapped['lot_id'] = "LOT-UCI-SECOM"
        mapped['burn_in_hour'] = 0
        mapped['temperature_c'] = 25
        mapped['voltage_v'] = 1.0
        mapped['iddq'] = df.get(0, None)  # Approximate mapping first sensor
        mapped['ileak'] = df.get(1, None)
        mapped['tpd'] = df.get(2, None)
        mapped['health_state'] = "UNKNOWN"
        mapped['defect_type'] = "NONE"
        mapped['anomaly_label'] = 0
        mapped['source_type'] = "proxy"
        mapped['source_dataset'] = "uci_secom"
        return mapped
