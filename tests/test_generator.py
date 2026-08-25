import os
import sys
import numpy as np
import pandas as pd

# Fix path to load src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.physics.generator import generate_lot_components

def test_generator_determinism():
    \"\"\"Verifies that generator output is fully reproducible under a fixed seed.\"\"\"
    configs = {
        "bti_time_exponent": 0.20,
        "bti_activation_energy_ev": 0.12,
        "measurement_noise_std": 0.00
    }
    
    np.random.seed(42)
    df1 = generate_lot_components("LOT-SYN-TEST", 5, [0, 24, 168], 125, 1.5, configs)
    
    np.random.seed(42)
    df2 = generate_lot_components("LOT-SYN-TEST", 5, [0, 24, 168], 125, 1.5, configs)
    
    pd.testing.assert_frame_equal(df1, df2, check_exact=False, rtol=1e-5)
    print("Test passed: Generator outputs are fully reproducible.")
    
def test_physics_drift_direction():
    """Verifies that aging causes tpd to increase (slow down) over time."""
    configs = {
        "bti_time_exponent": 0.20,
        "bti_activation_energy_ev": 0.12,
        "measurement_noise_std": 0.00
    }
    np.random.seed(42)
    df = generate_lot_components("LOT-SYN-TEST", 10, [0, 168], 125, 1.5, configs)
    
    h0 = df[df['burn_in_hour'] == 0]['tpd'].values
    h168 = df[df['burn_in_hour'] == 168]['tpd'].values
    
    assert np.mean(h168 > h0) >= 0.9, "Propagation delay did not slow down as expected under BTI stress"
    print("Test passed: Timing propagation delay drifts upward under bias stress.")

if __name__ == "__main__":
    test_generator_determinism()
    test_physics_drift_direction()
