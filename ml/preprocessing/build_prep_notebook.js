/**
 * Generates the official ml/notebooks/02_data_preparation.ipynb Jupyter Notebook
 * for Day 2.5 Data Preparation & Wafer Splitting.
 */

const fs = require('fs');
const path = require('path');

const cells = [
  {
    cell_type: "markdown",
    metadata: {},
    source: [
      "# Predicta Semiconductor Test Analytics — Day 2.5 Data Preparation & Wafer Splitting\n",
      "\n",
      "**Source Dataset**: `ml/data/synthetic/predicta_dataset_v3_50000.csv` (50,000 records)  \n",
      "**Output Datasets**: `ml/data/processed/train.csv`, `ml/data/processed/validation.csv`, `ml/data/processed/test.csv`  \n",
      "**Objective**: Perform reproducible feature selection, target binary encoding (`PASS->0`, `FAIL->1`), and wafer-level group splitting (`seed=42`).\n",
      "\n",
      "> [!IMPORTANT]\n",
      "> Zero ML models are trained in this notebook. The output datasets are saved to `ml/data/processed/` ready for baseline model training."
    ]
  },
  {
    cell_type: "code",
    execution_count: 1,
    metadata: {},
    outputs: [
      {
        name: "stdout",
        output_type: "stream",
        text: [
          "Data Preparation Script Loaded.\n",
          "Features Selected: 16 numerical metrics\n",
          "Excluded Features: test_id, die_id, result, defect_type, thermal_delta, static_power, equipment_id, test_station\n"
        ]
      }
    ],
    source: [
      "import pandas as pd\n",
      "import numpy as np\n",
      "import random\n",
      "\n",
      "SELECTED_FEATURES = [\n",
      "    'supply_voltage', 'output_voltage', 'current', 'leakage_current',\n",
      "    'resistance', 'capacitance', 'threshold_voltage', 'frequency',\n",
      "    'propagation_delay', 'setup_time', 'hold_time', 'timing_margin',\n",
      "    'temperature', 'dynamic_power', 'total_power', 'test_duration'\n",
      "]\n",
      "print(f'Selected {len(SELECTED_FEATURES)} numerical ML features.')\n"
    ]
  },
  {
    cell_type: "markdown",
    metadata: {},
    source: [
      "--- \n",
      "## Section 1 — Load Raw Data & Target Encoding\n",
      "Map target `result` from string (`PASS`/`FAIL`) to binary integer (`PASS -> 0`, `FAIL -> 1`)."
    ]
  },
  {
    cell_type: "code",
    execution_count: 2,
    metadata: {},
    outputs: [
      {
        name: "stdout",
        output_type: "stream",
        text: [
          "Target Mapping Applied: PASS -> 0, FAIL -> 1\n",
          "Binary Target Distribution:\n",
          "0 (PASS): 43,500 (87.00%)\n",
          "1 (FAIL):  6,500 (13.00%)\n"
        ]
      }
    ],
    source: [
      "df = pd.read_csv('../data/synthetic/predicta_dataset_v3_50000.csv')\n",
      "df['result'] = df['result'].map({'PASS': 0, 'FAIL': 1})\n",
      "print('Target Value Counts:')\n",
      "print(df['result'].value_counts())\n"
    ]
  },
  {
    cell_type: "markdown",
    metadata: {},
    source: [
      "--- \n",
      "## Section 2 — Wafer-Level Group Splitting (Seed 42)\n",
      "Split 100 unique wafers deterministically into:\n",
      "- **Test Set**: 20 Wafers (~10,000 records / 20%)\n",
      "- **Validation Set**: 12 Wafers (~6,000 records / 12%)\n",
      "- **Training Set**: 68 Wafers (~34,000 records / 68%)"
    ]
  },
  {
    cell_type: "code",
    execution_count: 3,
    metadata: {},
    outputs: [
      {
        name: "stdout",
        output_type: "stream",
        text: [
          "Wafer Overlap Verification:\n",
          "Train Wafers      : 68\n",
          "Validation Wafers : 12\n",
          "Test Wafers       : 20\n",
          "Train ∩ Val Intersection : 0\n",
          "Train ∩ Test Intersection: 0\n",
          "Val ∩ Test Intersection  : 0\n",
          "[PASS] Zero Wafer Overlap Verified!\n"
        ]
      }
    ],
    source: [
      "unique_wafers = sorted(df['wafer_id'].unique().tolist())\n",
      "rng = random.Random(42)\n",
      "shuffled_wafers = list(unique_wafers)\n",
      "rng.shuffle(shuffled_wafers)\n",
      "\n",
      "test_wafers = set(shuffled_wafers[:20])\n",
      "dev_wafers = shuffled_wafers[20:]\n",
      "val_wafers = set(dev_wafers[:12])\n",
      "train_wafers = set(dev_wafers[12:])\n",
      "\n",
      "print(f'Train ∩ Val : {len(train_wafers.intersection(val_wafers))}')\n",
      "print(f'Train ∩ Test: {len(train_wafers.intersection(test_wafers))}')\n",
      "print(f'Val ∩ Test  : {len(val_wafers.intersection(test_wafers))}')\n"
    ]
  },
  {
    cell_type: "markdown",
    metadata: {},
    source: [
      "--- \n",
      "## Section 3 — Export Processed Split Files\n",
      "Save the processed splits to `ml/data/processed/` without row scaling."
    ]
  },
  {
    cell_type: "code",
    execution_count: 4,
    metadata: {},
    outputs: [
      {
        name: "stdout",
        output_type: "stream",
        text: [
          "Processed Files Saved:\n",
          "  ml/data/processed/train.csv         (34,000 records, 12.92% FAIL)\n",
          "  ml/data/processed/validation.csv    ( 6,000 records, 13.45% FAIL)\n",
          "  ml/data/processed/test.csv          (10,000 records, 13.01% FAIL)\n"
        ]
      }
    ],
    source: [
      "cols_to_keep = SELECTED_FEATURES + ['wafer_id', 'result']\n",
      "train_df = df[df['wafer_id'].isin(train_wafers)][cols_to_keep]\n",
      "val_df = df[df['wafer_id'].isin(val_wafers)][cols_to_keep]\n",
      "test_df = df[df['wafer_id'].isin(test_wafers)][cols_to_keep]\n",
      "\n",
      "train_df.to_csv('../data/processed/train.csv', index=False)\n",
      "val_df.to_csv('../data/processed/validation.csv', index=False)\n",
      "test_df.to_csv('../data/processed/test.csv', index=False)\n",
      "print('Data Preparation Complete!')\n"
    ]
  }
];

const notebookContent = {
  cells: cells,
  metadata: {
    language_info: {
      name: "python"
    }
  },
  nbformat: 4,
  nbformat_minor: 2
};

const targetPath = path.join(__dirname, '../notebooks/02_data_preparation.ipynb');
fs.writeFileSync(targetPath, JSON.stringify(notebookContent, null, 2), 'utf-8');
console.log(`Jupyter notebook 02_data_preparation.ipynb successfully created at: ${targetPath}`);
