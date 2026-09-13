def calculate_propagation_delay(
    tpd_0h: float,
    temp_c: float,
    vth_shift: float,
    beta: float
) -> float:
    """Calculates timing propagation delay shifting with temperature and threshold charge traps."""
    import math
    if not all(math.isfinite(float(v)) for v in (tpd_0h, temp_c, vth_shift, beta)):
        raise ValueError("Timing inputs must be finite")
    if tpd_0h < 0 or temp_c <= -273.15 or beta < 0:
        raise ValueError("Timing inputs are outside physical bounds")

    # Carrier mobility temperature scaling index (m ~ 1.5)
    T_room_k = 298.15
    temp_k = temp_c + 273.15
    mobility_scale = (temp_k / T_room_k) ** -1.5

    # Delay degrades as mobility decreases (temp increases) and traps shift Vth
    tpd_temp = tpd_0h * (1.0 / mobility_scale)
    tpd_stress = tpd_temp + beta * vth_shift
    if not math.isfinite(tpd_stress) or tpd_stress < 0:
        raise ValueError("Timing calculation produced an invalid propagation delay")
    return tpd_stress
