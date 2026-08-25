import pandas as pd
from .base import BaseParser

class NasaMosfetParser(BaseParser):
    def load(self, file_path: str) -> pd.DataFrame:
        return pd.read_csv(file_path)

    def map_to_canonical(self, df: pd.DataFrame) -> pd.DataFrame:
        mapped = pd.DataFrame()
        mapped['component_id'] = df.get('device_id', 'COMP-NASA')
        mapped['lot_id'] = "LOT-NASA-PCOE"
        mapped['burn_in_hour'] = df.get('time_hours', 0)
        mapped['temperature_c'] = df.get('temp_c', 175)
        mapped['voltage_v'] = df.get('gate_voltage_v', 15.0)
        mapped['iddq'] = None
        mapped['ileak'] = df.get('gate_leakage_a', None)
        mapped['tpd'] = None
        mapped['vth'] = df.get('threshold_voltage_v', None)
        mapped['health_state'] = df.get('state', 'UNKNOWN')
        mapped['defect_type'] = df.get('defect', 'NONE')
        mapped['anomaly_label'] = df.get('fail_flag', 0)
        mapped['source_type'] = "proxy"
        mapped['source_dataset'] = "nasa_mosfet"
        return mapped
