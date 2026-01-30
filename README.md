# File Bridge Terminal

A local WebSocket server and Chrome extension pair that enables a web-based chat interface (like an AI chat) to read and write files on your local machine safely.

## Project Structure

- **`server/`**: A Node.js WebSocket server that handles file system operations.
- **`extension/`**: A Chrome extension that injects a client interface into web pages to communicate with the server.

## Installation

### 1. Start the Server

1.  Navigate to the `server` directory:
    ```bash
    cd server
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the server:
    ```bash
    node terminal-server.js
    ```
    The server will run on `ws://localhost:9091`.

### 2. Install the Extension

1.  Open Chrome or Edge.
2.  Go to `chrome://extensions`.
3.  Enable **Developer Mode** (usually a toggle in the top right).
4.  Click **Load Unpacked**.
5.  Select the `extension` folder from this project.

## Usage

1.  **Open your AI Chat Interface** (or any web page you want to bridge).
2.  **Enable the Bridge**:
    *   You should see a "File Bridge" UI injected into the page (bottom right).
    *   Enter the **absolute path** to your local project directory (e.g., `/home/user/my-project` or `C:\Users\Name\Projects\MyCode`).
    *   Click **Enable**.
3.  **Commands**:
    *   The extension listens for commands typed into text areas or the "File Bridge" UI.
    *   `@read <filename>`: Reads the content of a file.
    *   `@write <filename>`: Writes content to a file (will backup existing files).
    *   `@list [path]`: Lists files in a directory.

## Security Note

*   The server runs locally and allows file system access. Only run this when you are actively using it.
*   The `FileHandler` enforces that operations are contained within the specified project root.
