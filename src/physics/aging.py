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
    if not (np.isfinite(time_hours) and np.isfinite(temp_c) and np.isfinite(voltage_v) and np.isfinite(base_amp) and np.isfinite(exponent_n) and np.isfinite(activation_energy_ev)):
        raise ValueError("BTI numerical inputs must be finite numbers.")

    if time_hours < 0:
        raise ValueError("time_hours must be non-negative.")

    if temp_c <= -273.15:
        raise ValueError("Temperature must be strictly above absolute zero (-273.15°C).")

    kB = 8.617333262e-5
    temp_k = temp_c + 273.15

    # Voltage acceleration coefficient
    gamma = 1.3
    voltage_factor = max(0.1, voltage_v) ** gamma

    # Temperature Arrhenius prefactor
    arrh_exp = np.clip(-activation_energy_ev / (kB * temp_k), -700.0, 700.0)
    temp_factor = np.exp(arrh_exp)

    # BTI time power law
    time_factor = (time_hours ** exponent_n) if time_hours > 0 else 0.0

    return float(base_amp * temp_factor * voltage_factor * time_factor)

