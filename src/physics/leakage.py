import numpy as np

def calculate_leakage(leak_0h: float, temp_c: float, vth_shift: float, defect_type: str, time_hours: float, onset_hour: float) -> float:
    \"\"\"Models leakage currents mapping normal and defect breakdown trajectories.\"\"\"
    kB = 8.617333262e-5
    temp_k = temp_c + 273.15
    
    # Leakage activation energy (Ea ~ 0.55 eV)
    Ea = 0.55
    temp_factor = np.exp(-Ea / (kB * temp_k)) / np.exp(-Ea / (kB * 298.15))
    
    # Healthy base aging: leakage drops slightly as Vth shifts up
    base_leak = leak_0h * temp_factor * np.exp(-0.05 * vth_shift)
    
    # Inject defect breakdown paths
    if defect_type == "GATE_OXIDE_SHORT" and time_hours >= onset_hour:
        # Rapid exponential wear-out
        t_delta = time_hours - onset_hour
        breakdown_leak = 2.5 * np.exp(0.015 * t_delta)
        return base_leak + breakdown_leak
        
    elif defect_type == "STEP_BREAKDOWN" and time_hours >= onset_hour:
        # Sudden step displacement
        return base_leak + 15.0
        
    return base_leak
