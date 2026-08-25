import pytest
import pandas as pd
import numpy as np

@pytest.fixture
def sample_component_data():
    \"\"\"Provides a small mock lot representation for testing.\"\"\"
    np.random.seed(42)
    data = {
        'component_id': [f'IC_{i:03d}' for i in range(30)],
        'lot_id': ['LOT_01'] * 30,
        'iddq': np.random.normal(loc=10.0, scale=1.0, size=30),
        'ileak': np.random.normal(loc=1.5, scale=0.1, size=30),
        'tpd': np.random.normal(loc=120.0, scale=5.0, size=30)
    }
    return pd.DataFrame(data)
