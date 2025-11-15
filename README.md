# Kindred Paths
A tool for managing a collection of custom Magic the Gathering cards. Created by [Simon Karman](https://simonkarman.nl).

## Features
- **Card Management**: Add, edit, and delete Magic the Gathering cards from your collection.
- **View Rendered Cards**: View rendered Magic the Gathering cards in your collection with details like name, type, mana cost, artwork, and more.
- **Card AI Suggestions**: Get AI-generated text suggestions for things such as card names (via Anthropic).
- **Card AI Artwork**: Get AI-generated suggestions for card artwork (via LeonardoAI).
- **Set and Deck Management**: Create and manage sets and decks using the cards in your collection.
- **Printing**: Create a printable PDF of cards on A4 format suitable for easy cut out for play testing purposes.

![Kindred Paths](./kindred-paths.png)

## Prerequisites
Make sure you have the following tools installed on your system:
- **Git** — should be available by default, otherwise recommended to install from [git-scm](https://git-scm.com/downloads).
- **Node.js and npm** — Recommended to install from [nvm](https://github.com/nvm-sh/nvm) to install: `nvm install --lts` and `nvm use --lts`.
- **Docker** — Recommend to install [Docker Desktop](https://docs.docker.com/desktop/).
- Make sure no other applications are running on port `4100`, `4101`, or `4102`.

> Note: If you want to use AI suggestions, you will need an API key for an LLM provider (Anthropic or OpenAI) and/or [Leonardo AI](https://leonardo.ai/). These require a paid subscription.

## Getting Started
You can start the server and client in development mode. Run these commands in your terminal in the **root directory** of the repository:

```bash
# (optional) Set the environment variables if you want to use AI suggestions
# For text generation (card names, art settings, card generation):
export LLM_PROVIDER="anthropic"  # Options: "anthropic" (default) or "openai"
export ANTHROPIC_API_KEY="..."   # Required if using Anthropic (default provider)
# export OPENAI_API_KEY="..."    # Required if using OpenAI
# export LLM_MODEL="..."          # Optional: Override default model for selected provider

# For image generation (card artwork):
export LEONARDO_API_KEY="..."

# Make sure you have Docker running...
docker ps

# (optional) Use an existing collection from a repository - If you skip this step, you will start with an empty collection
git clone https://github.com/simonkarman/kindred-paths-collection.git collection

# Install and start the application (port 4100)
npm install
npm run dev
```

### LLM Provider Configuration

The application supports multiple LLM providers for text generation. You can configure which provider to use via environment variables:

- **`LLM_PROVIDER`**: Select the LLM provider to use
  - `anthropic` (default) - Uses Claude models from Anthropic
  - `openai` - Uses GPT models from OpenAI

- **`LLM_MODEL`**: (Optional) Override the default model for the selected provider
  - Anthropic default: `claude-opus-4-20250514`
  - OpenAI default: `gpt-4o`

**Example configurations:**

```bash
# Use Anthropic (default)
export LLM_PROVIDER="anthropic"
export ANTHROPIC_API_KEY="sk-ant-..."

# Use OpenAI
export LLM_PROVIDER="openai"
export OPENAI_API_KEY="sk-..."

# Use Anthropic with a different model
export LLM_PROVIDER="anthropic"
export ANTHROPIC_API_KEY="sk-ant-..."
export LLM_MODEL="claude-sonnet-4-20250514"

# Use OpenAI with a different model
export LLM_PROVIDER="openai"
export OPENAI_API_KEY="sk-..."
export LLM_MODEL="gpt-4o-mini"
```

You can now open the application in your browser on https://localhost:4100.

> The server is available on `http://localhost:4101` and Card Conjurer is available on `http://localhost:4102`.

## Troubleshooting
If you run into issues, here are some common troubleshooting steps:

### Cannot connect to the Docker daemon
You can get this error when trying to run the application and Docker is not running or not properly configured.

> Error: `"Cannot connect to the Docker daemon at unix:///Users/username/.docker/run/docker.sock. Is the docker daemon running?"`

This error indicates that Docker is not running on your system. Make sure you have Docker Desktop running and try again.

### Could not resolve authentication
You can get this error when trying to request card name suggestions, card art settings, or other text suggestions from your LLM provider.

> Error `"Error: Could not resolve authentication method. Expected either apiKey or authToken to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted"`

This means that you have not set the API key environment variable for your selected LLM provider. Make sure you have set the appropriate API key before starting the application:

- **For Anthropic** (default): Set `ANTHROPIC_API_KEY` - You can find [your keys in the Anthropic console](https://console.anthropic.com/settings/keys)
- **For OpenAI**: Set `OPENAI_API_KEY` - You can find [your keys in the OpenAI console](https://platform.openai.com/api-keys)

### Authentication hook unauthorized
You can get this error when trying to request art suggestions from Leonardo AI.

> Error: `"SDKError: Unexpected API response status or content-type: Status 401 Content-Type application/json; charset=utf-8 Body
{"error":"Authentication hook unauthorized this request","path":"$","code":"access-denied"}"`

This means that you have not set the environment variables for the Leonardo AI. Make sure you have set the `LEONARDO_API_KEY` environment variable in your terminal before starting the application. You can find [your keys in the Leonardo AI console](https://app.leonardo.ai/api-access).
