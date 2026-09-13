import numpy as np

def calculate_arrhenius_acceleration(
    temp_c_use: float,
    temp_c_stress: float,
    activation_energy_ev: float
) -> float:
    """Calculates temperature acceleration factor using the Arrhenius relation."""
    values = (temp_c_use, temp_c_stress, activation_energy_ev)
    if not all(np.isfinite(float(v)) for v in values):
        raise ValueError("Arrhenius inputs must be finite")
    if temp_c_use <= -273.15 or temp_c_stress <= -273.15:
        raise ValueError("Temperature must be above absolute zero")
    if activation_energy_ev < 0:
        raise ValueError("Activation energy cannot be negative")
    kB = 8.617333262e-5  # Boltzmann constant in eV/K
    T_use = temp_c_use + 273.15
    T_stress = temp_c_stress + 273.15

    exponent = (activation_energy_ev / kB) * ((1.0 / T_use) - (1.0 / T_stress))
    return np.exp(exponent)
