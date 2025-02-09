# Project Setup and Run Instructions

This document will guide you through setting up and running the backend of the project.

## Prerequisites

- **Git:** Make sure you have Git installed on your system.
- **Python:** Ensure you have Python 3.x installed.
- **Pip:** Pip should be available to install Python packages.
- (Optional) **Virtual Environment:** It’s recommended to use a virtual environment to manage your dependencies.

## Step 1: Clone the Repository

Clone the repository to your local machine by running:

```bash
git clone https://github.com/ExtraMediumDev/HackNYU.git
cd HackNYU/Backend
pip install -r requirements.txt
@"
OPENAI_KEY=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
ROBOFLOW_API_KEY=pzAWQwuNyJwc4VPqIZwa
"@ | Out-File -FilePath .env -Encoding ascii
python app.py
```

Run the application by visiting the generated link in the terminal (most likely http://127.0.0.1:5000/)
