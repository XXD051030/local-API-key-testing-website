# local-API-key-testing-website
A local API key testing website that supports models from multiple providers.

This project provides a simple, local web interface and backend to test your API keys across various AI model providers.

## Requirements

* Python 3.x

## Usage

1. Open a terminal in the project directory.
2. Start the local server using Python's built-in HTTP server:
   ```bash
   python3 -m http.server 8080
   ```
3. Open your web browser and navigate to `http://localhost:8080` (or the specific port you used).
4. Run the backend server to handle API requests (if `server.py` requires separate execution, start it according to its specific instructions, typically `python3 server.py`).

## Files Included

* `index.html`: The main frontend interface.
* `server.py`: The backend script for handling API key testing.
