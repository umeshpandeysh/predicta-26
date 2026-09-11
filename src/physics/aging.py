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
    if not all(np.isfinite(float(v)) for v in (time_hours, temp_c, voltage_v, base_amp, exponent_n, activation_energy_ev)):
        raise ValueError("BTI inputs must be finite")
    if time_hours < 0:
        raise ValueError("BTI time_hours cannot be negative")
    if temp_c <= -273.15:
        raise ValueError("Temperature must be above absolute zero")
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
