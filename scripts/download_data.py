import os
import sys
import argparse
import urllib.error
import urllib.request
import hashlib
import zipfile

# Dataset registry configuration
DATASETS = {
    "st_awfd": {
        "url": "https://github.com/STMicroelectronics/ST-AWFD/archive/refs/heads/master.zip",
        "dest": "data/raw/st_awfd_raw.zip",
        "extract_to": "data/raw/st_awfd/",
        "manual_instructions": None
    },
    "uci_secom": {
        "url": "https://archive.ics.uci.edu/ml/machine-learning-databases/secom/secom.data",
        "dest": "data/raw/uci_secom/secom.data",
        "extract_to": None,
        "manual_instructions": None
    },
    "nasa_mosfet": {
        "url": "https://ti.arc.nasa.gov/tech/dash/groups/pcoe/prognostic-data-repository/",
        "dest": "data/raw/nasa_mosfet/",
        "extract_to": None,
        "manual_instructions": (
            "==========================================================\n"
            "MANUAL DOWNLOAD REQUIRED: NASA MOSFET Dataset\n"
            "==========================================================\n"
            "Due to government licensing and prognostic repository login requirements,\n"
            "please download the MOSFET dataset manually:\n"
            "1. Visit: https://ti.arc.nasa.gov/tech/dash/groups/pcoe/prognostic-data-repository/\n"
            "2. Select '12. Power MOSFET Thermal Overstress Aging Dataset'.\n"
            "3. Extract and place the '.mat' or '.csv' files inside your local folder:\n"
            "   C:\\Users\\UMESH PANDEY\\Downloads\\ceenew\\data\\raw\\nasa_mosfet\\\n"
            "=========================================================="
        )
    }
}

def calculate_sha256(filepath):
    """Calculates the SHA-256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            sha256.update(chunk)
    return sha256.hexdigest()

def download_file(url, dest):
    """Downloads a file automatically using urllib."""
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    print(f"Downloading: {url} -> {dest}")

    # Custom headers to bypass bot blocks (some repositories require this)
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )

    with urllib.request.urlopen(req) as response, open(dest, 'wb') as out_file:
        data = response.read()
        out_file.write(data)

    print(f"Download complete. File size: {os.path.getsize(dest)} bytes.")
    print(f"SHA-256 Checksum: {calculate_sha256(dest)}")

def run_download(dataset_name):
    if dataset_name not in DATASETS:
        print(f"Error: Unknown dataset '{dataset_name}'")
        sys.exit(1)

    ds = DATASETS[dataset_name]

    # Check if manual download is required
    if ds["manual_instructions"]:
        print(ds["manual_instructions"])
        # Create destination folder for the user
        os.makedirs(ds["dest"], exist_ok=True)
        return

    # Automatic download
    try:
        download_file(ds["url"], ds["dest"])

        # Unzip if extraction folder is specified
        if ds["extract_to"]:
            print(f"Extracting archive: {ds['dest']} -> {ds['extract_to']}")
            os.makedirs(ds["extract_to"], exist_ok=True)
            with zipfile.ZipFile(ds["dest"], 'r') as zip_ref:
                zip_ref.extractall(ds["extract_to"])
            print("Extraction complete.")

    except (urllib.error.URLError, zipfile.BadZipFile, OSError) as e:
        print(f"Error downloading {dataset_name}: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="AIPS Reproducible Dataset Ingestion Tool")
    parser.add_argument(
        "--dataset",
        type=str,
        required=True,
        choices=["st_awfd", "uci_secom", "nasa_mosfet", "all"],
        help="Specify the dataset identifier to acquire."
    )
    args = parser.parse_args()

    if args.dataset == "all":
        for ds_name in DATASETS:
            print(f"\nProcessing dataset: {ds_name}...")
            run_download(ds_name)
    else:
        run_download(args.dataset)

if __name__ == "__main__":
    main()
