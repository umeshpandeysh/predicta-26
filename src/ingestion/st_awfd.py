import pandas as pd
from .base import BaseParser

class StAwfdParser(BaseParser):
    def load(self, file_path: str) -> pd.DataFrame:
        return pd.read_csv(file_path)
        
    def map_to_canonical(self, df: pd.DataFrame) -> pd.DataFrame:
        mapped = pd.DataFrame()
        mapped['component_id'] = df.index.map(lambda i: f"COMP-ST-{i:06d}")
        mapped['lot_id'] = "LOT-ST-AWFD"
        mapped['burn_in_hour'] = 0  # Static E-test snapshot
        mapped['temperature_c'] = 25
        mapped['voltage_v'] = 1.0
        mapped['iddq'] = df.get('e_test_1', pd.Series([None]*len(df)))
        mapped['ileak'] = df.get('e_test_2', pd.Series([None]*len(df)))
        mapped['tpd'] = df.get('e_test_3', pd.Series([None]*len(df)))
        mapped['health_state'] = df.get('label', pd.Series(['UNKNOWN']*len(df))).map(
            lambda label: 'FAILED' if label == 1 else 'HEALTHY'
        )
        mapped['defect_type'] = df.get('label', pd.Series(['NONE']*len(df))).map(
            lambda label: 'PROCESS_ANOMALY' if label == 1 else 'NONE'
        )
        mapped['anomaly_label'] = df.get('label', 0)
        mapped['source_type'] = "proxy"
        mapped['source_dataset'] = "st_awfd"
        return mapped
