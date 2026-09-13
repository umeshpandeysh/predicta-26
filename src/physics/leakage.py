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
    values = (leak_0h, temp_c, vth_shift, time_hours, onset_hour)
    if not all(np.isfinite(float(v)) for v in values):
        raise ValueError("Leakage inputs must be finite")
    if leak_0h < 0 or time_hours < 0 or temp_c <= -273.15:
        raise ValueError("Leakage inputs are outside physical bounds")
    if onset_hour < 0:
        raise ValueError("Leakage onset_hour cannot be negative")
    if defect_type not in {"NORMAL", "NONE", "TIMING_OFFSET", "GATE_OXIDE_SHORT", "STEP_BREAKDOWN"}:
        raise ValueError(f"Unsupported defect_type: {defect_type}")
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
