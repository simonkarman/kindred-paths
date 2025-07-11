# Kindred Paths
A tool for managing the cards in Kindred Paths, the custom Magic the Gathering set by [Simon Karman](https://simonkarman.nl).

## Installation
Make sure you have the [Card Conjurer](https://github.com/Investigamer/cardconjurer/) Docker image installed and running. You can do this by running, cloning that repository and running the following commands:

```bash
docker build -f Dockerfile --target "prod" . -t "cardconjurer-client"
docker run -dit -v "$(pwd)/local_art:/usr/share/nginx/html/local_art" -h 127.0.0.1 -p 4242:4242 "cardconjurer-client"
```

Card Conjurer will now be available on `http://localhost:4242`.

Then, you can start the server and client in development mode.

```bash
cd server
npm install
npm run dev
```

Now, the server should be available on `http://localhost:4243` and the client should be available on `http://localhost:3000`.

Happy coding!
