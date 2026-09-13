import numpy as np

def calculate_arrhenius_acceleration(
    temp_c_use: float,
    temp_c_stress: float,
    activation_energy_ev: float
) -> float:
    """Calculates temperature acceleration factor using the Arrhenius relation."""
    if not (np.isfinite(temp_c_use) and np.isfinite(temp_c_stress) and np.isfinite(activation_energy_ev)):
        raise ValueError("Temperature and activation energy inputs must be finite numbers.")

    if temp_c_use <= -273.15 or temp_c_stress <= -273.15:
        raise ValueError("Temperatures must be strictly above absolute zero (-273.15°C).")

    if activation_energy_ev < 0:
        raise ValueError("Activation energy must be non-negative (Ea >= 0 eV).")

    kB = 8.617333262e-5  # Boltzmann constant in eV/K
    T_use = temp_c_use + 273.15
    T_stress = temp_c_stress + 273.15

    exponent = (activation_energy_ev / kB) * ((1.0 / T_use) - (1.0 / T_stress))
    # Clip exponent to [-700, 700] to prevent floating point overflow / underflow
    clipped_exp = np.clip(exponent, -700.0, 700.0)
    return float(np.exp(clipped_exp))

