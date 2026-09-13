# PREDICTA-26 ? Reproduction Guide & Audit Commands

---

## 1. Environment Setup
```bash
# Clone the verified repository
git clone https://github.com/umeshpandeysh/predicta-26.git
cd predicta-26

# Python dependencies
pip install -r requirements.txt

# Node.js dependencies
npm install --no-audit --no-fund
```

## 2. Audit Commands

### 1. Execute Production Benchmark Evaluator
```bash
python scripts/evaluate_production.py
```
*Outputs certified benchmark table and generates `ml/analysis/reports/production_evaluation_report.json`.*

### 2. Run Complete Python Verification Suite
```bash
pytest -v
```
*Executes 60 tests across schemas, parity, physics boundaries, and leakage isolation (0 warnings).*

### 3. Run Complete Node.js Verification Suite
```bash
npm test
```
*Executes all 27 Node.js test suites defined in package.json (0 failures).*

### 4. Verify Code Formatting & Linting
```bash
ruff check src tests scripts
```
*Verifies 100% clean formatting with zero errors.*
