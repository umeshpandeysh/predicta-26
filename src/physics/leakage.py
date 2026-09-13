import numpy as np

def calculate_leakage(
    leak_0h: float,
    temp_c: float,
    vth_shift: float,
    defect_type: str,
    time_hours: float,
    onset_hour: float
) -> float:
    """Models leakage currents mapping normal and defect breakdown trajectories."""
    if not (np.isfinite(leak_0h) and np.isfinite(temp_c) and np.isfinite(vth_shift) and np.isfinite(time_hours) and np.isfinite(onset_hour)):
        raise ValueError("Leakage numerical inputs must be finite numbers.")

    if leak_0h < 0:
        raise ValueError("leak_0h must be non-negative.")

    if time_hours < 0:
        raise ValueError("time_hours must be non-negative.")

    if temp_c <= -273.15:
        raise ValueError("Temperature must be strictly above absolute zero (-273.15°C).")

    kB = 8.617333262e-5
    temp_k = temp_c + 273.15

    # Leakage activation energy (Ea ~ 0.55 eV)
    Ea = 0.55
    temp_factor = np.exp(-Ea / (kB * temp_k)) / np.exp(-Ea / (kB * 298.15))

    # Healthy base aging: leakage drops slightly as Vth shifts up
    vth_exp = np.clip(-0.05 * vth_shift, -50.0, 50.0)
    base_leak = leak_0h * temp_factor * np.exp(vth_exp)

    # Inject defect breakdown paths
    if defect_type == "GATE_OXIDE_SHORT" and time_hours >= onset_hour:
        # Rapid exponential wear-out with overflow protection
        t_delta = max(0.0, time_hours - onset_hour)
        breakdown_leak = 2.5 * np.exp(min(50.0, 0.015 * t_delta))
        return float(base_leak + breakdown_leak)

    elif defect_type == "STEP_BREAKDOWN" and time_hours >= onset_hour:
        # Sudden step displacement
        return float(base_leak + 15.0)

    return float(base_leak)
