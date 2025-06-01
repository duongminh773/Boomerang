#!/bin/bash

# Set your source extension directory
SRC="boomerang-extension"

# Chrome build
echo "Building Chrome package..."
CHROME_DIR="boomerang-chrome"
rm -rf "$CHROME_DIR"
cp -r "$SRC" "$CHROME_DIR"
cp "$SRC/manifest-chrome.json" "$CHROME_DIR/manifest.json"
rm -f "$CHROME_DIR/manifest-chrome.json" "$CHROME_DIR/manifest-firefox.json" "$CHROME_DIR/background-firefox.js"
cd "$CHROME_DIR" && zip -r ../boomerang-chrome.zip . && cd ..

echo "Chrome package ready: boomerang-chrome.zip"

# Firefox build
echo "Building Firefox package..."
FIREFOX_DIR="boomerang-firefox"
rm -rf "$FIREFOX_DIR"
cp -r "$SRC" "$FIREFOX_DIR"
cp "$SRC/manifest-firefox.json" "$FIREFOX_DIR/manifest.json"
cp "$SRC/background-firefox.js" "$FIREFOX_DIR/background-firefox.js"
rm -f "$FIREFOX_DIR/manifest-chrome.json" "$FIREFOX_DIR/background.js"
cd "$FIREFOX_DIR" && zip -r ../boomerang-firefox.zip . && cd ..

echo "Firefox package ready: boomerang-firefox.zip"

echo "Build complete!" 