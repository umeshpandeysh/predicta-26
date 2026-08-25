import numpy as np

def calculate_arrhenius_acceleration(
    temp_c_use: float,
    temp_c_stress: float,
    activation_energy_ev: float
) -> float:
    """Calculates temperature acceleration factor using the Arrhenius relation."""
    kB = 8.617333262e-5  # Boltzmann constant in eV/K
    T_use = temp_c_use + 273.15
    T_stress = temp_c_stress + 273.15

    exponent = (activation_energy_ev / kB) * ((1.0 / T_use) - (1.0 / T_stress))
    return np.exp(exponent)
