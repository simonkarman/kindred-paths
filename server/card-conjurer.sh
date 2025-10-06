#!/bin/bash

# Check if .cardconjurer directory exists
if [ ! -d ".cardconjurer" ]; then
  echo "Cloning Card Conjurer to .cardconjurer directory"
  # git clone https://github.com/Investigamer/cardconjurer/ .cardconjurer
  git clone git@github.com:joshbirnholz/cardconjurer.git .cardconjurer
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

  # Check if the "kindred-paths-cardconjurer" docker image exists
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
 -v "$(pwd)/content/art:/usr/share/nginx/html/local_art:ro" \
 -v "$(pwd)/content/icons:/usr/share/nginx/html/img/setSymbols/official/custom:ro" \
 -h 127.0.0.1 -p 4102:4242 "kindred-paths-cardconjurer"
