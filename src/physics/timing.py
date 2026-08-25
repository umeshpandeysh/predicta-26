def calculate_propagation_delay(
    tpd_0h: float,
    temp_c: float,
    vth_shift: float,
    beta: float
) -> float:
    """Calculates timing propagation delay shifting with temperature and threshold charge traps."""
    # Carrier mobility temperature scaling index (m ~ 1.5)
    T_room_k = 298.15
    temp_k = temp_c + 273.15
    mobility_scale = (temp_k / T_room_k) ** -1.5

    # Delay degrades as mobility decreases (temp increases) and traps shift Vth
    tpd_temp = tpd_0h * (1.0 / mobility_scale)
    tpd_stress = tpd_temp + beta * vth_shift
    return tpd_stress
