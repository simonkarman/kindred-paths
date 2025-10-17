#!/bin/sh

# Skip if CARD_CONJURER_URL is set
if [ -n "$CARD_CONJURER_URL" ]; then
  echo "CARD_CONJURER_URL is set, skipping Card Conjurer setup"
  exit 0
fi

# Skip if git or docker are not installed
if ! command -v git >/dev/null 2>&1 || ! command -v docker >/dev/null 2>&1; then
  echo "git or docker not installed, skipping Card Conjurer setup"
  exit 0
fi

# Check if .cardconjurer directory exists
if [ ! -d ".cardconjurer" ]; then
  echo "Cloning Card Conjurer to .cardconjurer directory"
  git clone https://github.com/joshbirnholz/cardconjurer.git .cardconjurer
else
  echo ".cardconjurer exists"
fi

(
  # Change to the .cardconjurer directory and pull the latest changes
  cd ".cardconjurer" || exit 1
  git add --all
  git reset --hard
  git pull

  # Check if local_art is in the .dockerignore file
  if ! grep -q "local_art/" .dockerignore; then
    echo "Adding local_art to .dockerignore"
    printf "\n# Local Art\nlocal_art/\n" >> .dockerignore
  else
    echo "local_art is already in .dockerignore"
  fi

  # Build "kindred-paths-cardconjurer" docker image
  echo "Building Card Conjurer Docker image"
  docker build -f Dockerfile --target "prod" . -t "kindred-paths-cardconjurer"
)

# Check if the container is already running
if [ "$(docker ps -q -a -f name=kindred-paths-cardconjurer)" ]; then
  echo "Card Conjurer is already running, stopping it first"
  docker stop kindred-paths-cardconjurer
  docker rm kindred-paths-cardconjurer
fi

# Start the Card Conjurer container at port 4102
echo "Starting Card Conjurer at port 4102"
docker run --name "kindred-paths-cardconjurer" -dit \
 -v "$(pwd)/../collection/art:/usr/share/nginx/html/local_art:ro" \
 -v "$(pwd)/../collection/symbols:/usr/share/nginx/html/img/setSymbols/official/custom:ro" \
 -h 127.0.0.1 -p 4102:4242 "kindred-paths-cardconjurer"
