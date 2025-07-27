# Kindred Paths
A tool for managing the cards in Kindred Paths, the custom Magic the Gathering set by [Simon Karman](https://simonkarman.nl).

## Installation
Make sure you have the following tools installed on your system:
- Git
- Node.js (v18 or higher)
- npm (v8 or higher)
- Docker

You can start the server and client in development mode.

```bash
# Set the environment variables if you want to use AI suggestions
export ANTHROPIC_API_KEY="..."
export LEONARDO_API_KEY="..."

# Make sure you have Docker running...
npm install
npm run dev
```

Now, the server should be available on `http://localhost:4101` and the client should be available on `http://localhost:4100`.

> For development purposes Card Conjurer will now be available on `http://localhost:4102`.

Happy coding!
