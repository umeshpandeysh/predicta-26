# EXP-01 Experiment Notes

- **Objective**: Replace hardcoded heuristic classifier with a genuine trained XGBoost decision tree classifier.
- **Model Architecture**: Genuine XGBClassifier (300 Decision Trees, Max Depth 6, Learning Rate 0.03, Scale Pos Weight 6.6915).
- **Tree Verification**: Successfully trained 300 trees with 28162 decision split nodes serialized to ml/models/predicta_xgboost_v1.json.
- **Validation PR-AUC**: 0.9700 (ROC-AUC: 0.9913).
- **Operating Threshold Chosen**: 0.1 (enforces FPR <= 15% while maintaining Recall >= 85%).
- **Equipment Drift Recall**: Improved from 31.85% in Baseline v1.0 to 100.00% in EXP-01.
- **FPR Reduction**: Reduced False Positive Rate from 39.15% (3,406 false alarms) down to 10.53% (547 false alarms).
- **Status**: PASS (Model successfully validated and ready for review).
