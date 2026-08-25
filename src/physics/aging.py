import numpy as np

def bti_threshold_drift(
    time_hours: float,
    temp_c: float,
    voltage_v: float,
    base_amp: float,
    exponent_n: float,
    activation_energy_ev: float
) -> float:
    """Calculates threshold shift using Bias Temperature Instability power kinetics."""
    kB = 8.617333262e-5
    temp_k = temp_c + 273.15

    # Voltage acceleration coefficient
    gamma = 1.3
    voltage_factor = max(0.1, voltage_v) ** gamma

    # Temperature Arrhenius prefactor
    temp_factor = np.exp(-activation_energy_ev / (kB * temp_k))

    # BTI time power law
    time_factor = time_hours ** exponent_n

    return base_amp * temp_factor * voltage_factor * time_factor
