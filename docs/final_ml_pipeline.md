# Predicta Final Machine Learning Pipeline Specification

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. 28 Authoritative Feature Definitions & Physical Units

| Domain | Parameter Name | Physical Unit | Description / Physics Formula |
| :--- | :--- | :--- | :--- |
| **Electrical** | `supply_voltage` | Volts ($V$) | Nominal core supply voltage ($1.20V \pm 0.05V$) |
| **Electrical** | `output_voltage` | Volts ($V$) | Measured output logic high level ($1.18V$) |
| **Electrical** | `current` | Milliamperes ($mA$) | Total active current ($i_{dyn} + i_{leak}$) |
| **Electrical** | `leakage_current` | Microamperes ($\mu A$) | Reverse-bias junction leakage ($100\mu A \dots 300\mu A$) |
| **Electrical** | `resistance` | Ohms ($\Omega$) | Interconnect path resistance ($12.0\Omega$) |
| **Electrical** | `capacitance` | Picofarads ($pF$) | Pin loading capacitance ($4.0pF$) |
| **Electrical** | `threshold_voltage` | Volts ($V$) | Transistor threshold voltage ($0.45V$) |
| **Timing** | `frequency` | Megahertz ($MHz$) | Operating clock frequency ($2500.0MHz$) |
| **Timing** | `propagation_delay` | Nanoseconds ($ns$) | Signal propagation delay ($11.5ns$) |
| **Timing** | `setup_time` | Nanoseconds ($ns$) | Flip-flop setup time ($1.2ns$) |
| **Timing** | `hold_time` | Nanoseconds ($ns$) | Flip-flop hold time ($0.8ns$) |
| **Timing** | `timing_margin` | Nanoseconds ($ns$) | Setup/hold timing slack ($2.2ns$) |
| **Thermal** | `temperature` | Degrees Celsius ($^\circ C$) | Chamber thermal measurement ($25.0°C \dots 75.0°C$) |
| **Power** | `dynamic_power` | Milliwatts ($mW$) | Switching dynamic power dissipation ($42.0mW$) |
| **Power** | `total_power` | Milliwatts ($mW$) | Total power dissipation ($52.0mW$) |
| **Duration** | `test_duration` | Milliseconds ($ms$) | ATE test execution duration ($12.0ms$) |
